/* 使用者回報：Agnes 持續遇到 rate_limit（429），想確認兩件事：
 *   ① 輸入 Agnes API Key 後，程式是不是誤打到 Claude？
 *   ② 目前是否每分鐘超過 RPM 20？
 *
 * 測試方式（遵守鐵律第8條）：直接從 index.html 擷取專案裡真正的 callAI 分派邏輯
 * 原始碼與 AgnesRateTracker 原始碼，用真實程式碼＋假的 fetch／可控時間來驗證，
 * 不另外重寫一份簡化邏輯。
 *
 * 用法：node _project-improvement/tests/stage-agnes-rpm-and-routing.test.js
 */
const { readIndex, extractDeclaration } = require('./lib/extract.js');
const html = readIndex();

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ✅ ' + name + (detail ? '　' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '　' + detail : '')); }
}

console.log('\n=== 問題①：Agnes Key 會不會誤打到 Claude？ ===\n');

// 直接檢查 callAI 的原始碼：provider==='agnes' 的分支必須「只」呼叫 callAgnes，
// 且必須在檢查 claude 分支「之前」就先 return，程式邏輯上不可能漏到下面的 callClaude。
const callAiSrc = extractDeclaration(html, 'async function callAI(systemPrompt, userPrompt, maxTokens, enableSearch, modelTier, maxUses, abortSignal){');
check('callAI() 原始碼中，provider===\'agnes\' 時會呼叫 callAgnes 並直接 return',
  /if\(provider==='agnes'\)\s*return await callAgnes\(/.test(callAiSrc));
check('callAgnes 分支寫在 callClaude 呼叫之前（agnes 一定會提前 return，不會執行到 callClaude）',
  callAiSrc.indexOf("provider==='agnes'") < callAiSrc.indexOf('return await callClaude('));
check('callAgnes() 內部沒有呼叫 callClaude 或 Anthropic 端點（不存在任何交叉呼叫）',
  extractDeclaration(html, 'async function callAgnes(systemPrompt, userPrompt, maxTokens, enableSearch, abortSignal){')
    .indexOf('callClaude') === -1);

// 端對端：實際執行 callAI 分派邏輯，用假的 callAgnes/callClaude 確認真的只有 agnes 被呼叫
{
  const dispatch = new Function('callGemini', 'callAgnes', 'callClaude', 'getProvider',
    callAiSrc + '\nreturn callAI;'
  );
  let agnesCalled = 0, claudeCalled = 0, geminiCalled = 0;
  const fn = dispatch(
    async()=>{ geminiCalled++; return {}; },
    async()=>{ agnesCalled++; return {text:'{}', citations:[], truncated:false}; },
    async()=>{ claudeCalled++; return {}; },
    () => 'agnes'
  );
  return fn('sys','usr',1000,true).then(()=>{
    check('實際執行：provider=\'agnes\' 時，callAgnes 恰好被呼叫 1 次', agnesCalled===1 && claudeCalled===0 && geminiCalled===0,
      'agnes='+agnesCalled+' claude='+claudeCalled+' gemini='+geminiCalled);
    runRpmTests();
  });
}

function runRpmTests(){
  console.log('\n=== 問題②：目前是否可能超過 RPM 20？ ===\n');

  // ---- 用可控的 Date.now 驅動真實的 AgnesRateTracker 原始碼 ----
  const trackerSrc = extractDeclaration(html, 'const AgnesRateTracker = (function(){') + ')();';
  const softLimitMatch = html.match(/const AGNES_RPM_SOFT_LIMIT = (\d+)/);
  check('已定義 RPM 警戒線常數（低於官方常見的 20，留緩衝）',
    !!softLimitMatch && Number(softLimitMatch[1]) < 15 && Number(softLimitMatch[1]) > 0,
    softLimitMatch && softLimitMatch[1]);

  let fakeNow = 1_000_000;
  const fakeDate = { now: () => fakeNow };
  const buildTracker = () => new Function('Date', trackerSrc + '\nreturn AgnesRateTracker;')(fakeDate);

  {
    fakeNow = 1_000_000;
    const tracker = buildTracker();
    check('初始狀態：60秒內呼叫次數為 0', tracker.countInWindow() === 0);
    for(let i=0;i<5;i++){ tracker.record(); fakeNow += 1000; }
    check('連續 5 次呼叫後，滾動窗口內正確計為 5 次', tracker.countInWindow() === 5);
  }
  {
    fakeNow = 2_000_000;
    const tracker = buildTracker();
    // 模擬「使用者測試時密集操作」：每3秒打一次，連續打 20 次，全部落在同一個 60 秒視窗內
    // （20 次 × 間隔 3 秒 = 最後一次發生在第 57 秒，仍在 60 秒視窗內，20 次全部有效）
    for(let i=0;i<20;i++){ tracker.record(); if(i<19) fakeNow += 3000; }
    check('模擬 60 秒內 20 次請求：滾動窗口正確計為 20 次（證明計數邏輯本身正確可信）',
      tracker.countInWindow() === 20, '實際 ' + tracker.countInWindow() + ' 筆');
  }
  {
    fakeNow = 3_000_000;
    const tracker = buildTracker();
    tracker.record();
    fakeNow += 30000;
    tracker.record();
    fakeNow += 40000; // 第一筆已超過 60 秒視窗，應該被淘汰
    check('超過 60 秒視窗的舊請求會被正確淘汰，不會一直累加', tracker.countInWindow() === 1,
      '實際剩餘 ' + tracker.countInWindow() + ' 筆');
  }
  {
    fakeNow = 4_000_000;
    const tracker = buildTracker();
    check('沒有任何請求時，msUntilOldestExpires() 回傳 0（不會無謂等待）', tracker.msUntilOldestExpires() === 0);
    tracker.record();
    fakeNow += 10000; // 過了 10 秒
    const wait = tracker.msUntilOldestExpires();
    check('已過 10 秒時，距離該筆請求滿 60 秒還需等待約 50 秒', Math.abs(wait - 50000) < 1, '實際 ' + wait + 'ms');
  }

  // ---- 端對端：callAgnes 在接近上限時會主動延後新請求 ----
  {
    const callAgnesSrc = extractDeclaration(html, 'async function callAgnes(systemPrompt, userPrompt, maxTokens, enableSearch, abortSignal){');
    const fetchWithRetrySrc = extractDeclaration(html, 'async function fetchWithRetry(fetchFn, maxRetries, onRetry, externalSignal, timeoutMs){');
    const retryConsts = [
      'const RETRYABLE_STATUSES=' + (html.match(/const RETRYABLE_STATUSES=(\[[^\]]*\])/) || [])[1] + ';',
      'const RATE_LIMIT_MIN_WAIT_MS=' + (html.match(/const RATE_LIMIT_MIN_WAIT_MS=(\d+)/) || [])[1] + ';',
      'const RETRY_MAX_WAIT_MS=' + (html.match(/const RETRY_MAX_WAIT_MS=(\d+)/) || [])[1] + ';',
      extractDeclaration(html, 'function parseRetryAfterMs(resp){'),
      extractDeclaration(html, 'function computeRetryWaitMs(resp, attempt){')
    ].join('\n');

    let now2 = 2_000_000;
    const fakeWindow = { __aiDiag:{} };
    const waited = [];
    const pendingTimers = new Set();
    const fakeSetTimeout = (fn, ms) => {
      const id = pendingTimers.size + 1;
      if(ms > 10000){ waited.push(ms); now2 += ms; fn(); }
      else { pendingTimers.add(id); }
      return id;
    };
    const fakeClearTimeout = (id) => pendingTimers.delete(id);
    const quotaLoadSrc = extractDeclaration(html, 'function loadAgnesQuota(){');
    const quotaSaveSrc = extractDeclaration(html, 'function saveAgnesQuota(state){');
    const quotaWaitSrc = extractDeclaration(html, 'function quotaWaitMs(list, now){');
    const quotaGuardSrc = extractDeclaration(html, 'const AgnesQuotaGuard = {');
    const src = trackerSrc
      + '\nconst AGNES_RPM_SOFT_LIMIT = ' + softLimitMatch[1] + ';'
      + '\nconst AGNES_RPM_LIMIT = ' + softLimitMatch[1] + ';'
      + '\nconst AGNES_RPD_LIMIT = 29; const AGNES_TPM_LIMIT = 9999;'
      + '\nconst AGNES_QUOTA_KEY = "test-quota"; const AGNES_QUOTA_WINDOW_MS = 60000;'
      + '\n' + quotaLoadSrc + '\n' + quotaSaveSrc + '\n' + quotaWaitSrc + '\n' + quotaGuardSrc
      + '\n' + retryConsts + '\n' + fetchWithRetrySrc + '\n' + callAgnesSrc;
    const fakeStorage = { _m:new Map(), getItem(k){return this._m.has(k)?this._m.get(k):null;}, setItem(k,v){this._m.set(k,String(v));} };
    const RealDate = Date;
    function FakeDate(...args){ return args.length ? new RealDate(...args) : new RealDate(now2); }
    FakeDate.now = () => now2;
    FakeDate.parse = RealDate.parse; FakeDate.UTC = RealDate.UTC;
    const fn = new Function(
      'Date', 'localStorage', 'window', 'console', 'setTimeout', 'clearTimeout', 'sessionStorage', 'fetch', 'AbortController',
      'getKeyFor', 'flattenSystemPrompt', 'estimateTokens', 'computeAttemptTimeoutMs',
      src + '\nreturn callAgnes;'
    )(
      FakeDate, fakeStorage, fakeWindow, { info(){}, warn(){}, error(){} }, fakeSetTimeout, fakeClearTimeout,
      { getItem: () => null },
      async () => ({ ok:true, status:200, headers:{get:()=>null}, text: async()=>'', json: async()=>({choices:[{message:{content:'{}'}}]}) }),
      AbortController,
      () => 'fake-agnes-key',
      sys => (typeof sys === 'object' ? (sys.cached||'')+(sys.dynamic||'') : String(sys||'')),
      s => Math.ceil(String(s||'').length/4),
      () => 5000
    );

    return (async () => {
      // 直接預載真實 quota guard 使用的 localStorage 狀態，模擬 14 RPM 已用滿，
      // 再確認下一個 HTTP attempt 會先等待額度釋放。
      const quotaNow = now2;
      fakeStorage.setItem('test-quota', JSON.stringify({
        day: new FakeDate().toISOString().slice(0,10),
        daily: Number(softLimitMatch[1]),
        requests: Array.from({length:Number(softLimitMatch[1])}, (_,i)=>quotaNow-500+i),
        tokens: Array.from({length:Number(softLimitMatch[1])}, (_,i)=>({at:quotaNow-500+i,tokens:100}))
      }));
      waited.length = 0;
      await fn('sys','usr',1000,false,null);
      check('累積請求數達到警戒線後，下一次新請求會主動等待（而不是立刻送出再撞 429）',
        waited.some(w => w > 0), '實際等待紀錄：' + JSON.stringify(waited));
    })().then(() => {
      console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗\n');
      process.exit(fail ? 1 : 0);
    });
  }
}
