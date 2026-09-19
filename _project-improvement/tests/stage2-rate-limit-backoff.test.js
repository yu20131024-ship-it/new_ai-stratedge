/* 階段2 驗證：429（速率限制）專用退避策略與 Retry-After 支援
 *
 * 測試方式（遵守鐵律第8條）：直接從 index.html 擷取專案裡真正的
 * parseRetryAfterMs / computeRetryWaitMs / fetchWithRetry 原始碼來驅動，
 * 並以假的 fetch 與假的計時器驗證「實際等了多久」。
 *
 * 用法：node _project-improvement/tests/stage2-rate-limit-backoff.test.js
 */
const { readIndex, extractDeclaration } = require('./lib/extract.js');
const html = readIndex();

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ✅ ' + name + (detail ? '　' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '　' + detail : '')); }
}

const src = [
  'const RETRYABLE_STATUSES=' + (html.match(/const RETRYABLE_STATUSES=(\[[^\]]*\])/) || [])[1] + ';',
  'const RATE_LIMIT_MIN_WAIT_MS=' + (html.match(/const RATE_LIMIT_MIN_WAIT_MS=(\d+)/) || [])[1] + ';',
  'const RETRY_MAX_WAIT_MS=' + (html.match(/const RETRY_MAX_WAIT_MS=(\d+)/) || [])[1] + ';',
  'const AI_ATTEMPT_TIMEOUT_MS=' + (html.match(/const AI_ATTEMPT_TIMEOUT_MS=(\d+)/) || [])[1] + ';',
  extractDeclaration(html, 'function parseRetryAfterMs(resp){'),
  extractDeclaration(html, 'function computeRetryWaitMs(resp, attempt){'),
  extractDeclaration(html, 'async function fetchWithRetry(fetchFn, maxRetries, onRetry, externalSignal, timeoutMs){')
].join('\n\n');
const mod = new Function('AbortController', 'setTimeout', 'clearTimeout',
  src + '\nreturn {parseRetryAfterMs, computeRetryWaitMs, fetchWithRetry, RATE_LIMIT_MIN_WAIT_MS, RETRY_MAX_WAIT_MS};'
)(AbortController, setTimeout, clearTimeout);

function resp(status, retryAfter){
  return { ok: status >= 200 && status < 300, status,
    headers: { get: n => (n.toLowerCase() === 'retry-after' && retryAfter != null) ? String(retryAfter) : null } };
}

console.log('\n=== 階段2：429 退避策略與 Retry-After 驗證 ===\n');

// ① Retry-After 解析（秒數／HTTP 日期／缺漏）
check('Retry-After 秒數格式解析正確', mod.parseRetryAfterMs(resp(429, '30')) === 30000);
check('Retry-After 為 0 時解析為 0（不是當成沒給）', mod.parseRetryAfterMs(resp(429, '0')) === 0);
{
  const future = new Date(Date.now() + 20000).toUTCString();
  const got = mod.parseRetryAfterMs(resp(429, future));
  check('Retry-After HTTP 日期格式解析正確', got > 17000 && got <= 20000, got + ' ms');
}
check('沒有 Retry-After 時回傳 null', mod.parseRetryAfterMs(resp(429)) === null);
check('標頭格式無效時不會丟例外，回傳 null', mod.parseRetryAfterMs(resp(429, 'not-a-date')) === null);

// ② 429 與 503 的退避節奏必須分開
{
  const w429 = mod.computeRetryWaitMs(resp(429), 0);
  const w503 = mod.computeRetryWaitMs(resp(503), 0);
  check('429 首次等待 ≥ 8 秒（不再用 1.5 秒硬敲門）', w429 >= 8000, w429 + ' ms');
  check('503 維持原本較短的退避節奏', w503 >= 1500 && w503 < 8000, w503 + ' ms');
  check('429 的等待明顯長於 503', w429 > w503 * 2);
  const w429b = mod.computeRetryWaitMs(resp(429), 1);
  check('429 第二次重試呈指數成長（≥16 秒）', w429b >= 16000, w429b + ' ms');
}

// ③ 伺服器指示優先，且只會更久不會更短
{
  const w = mod.computeRetryWaitMs(resp(429, '45'), 0);
  check('伺服器要求等 45 秒時，實際等待 ≥ 45 秒', w >= 45000, w + ' ms');
  const w2 = mod.computeRetryWaitMs(resp(429, '1'), 0);
  check('伺服器要求只等 1 秒時，仍守住 8 秒下限（不被哄騙提早重打）', w2 >= 8000, w2 + ' ms');
}

// ④ 超過上限就不重試
check('伺服器要求等待超過 60 秒上限時回傳 null（停止重試）',
  mod.computeRetryWaitMs(resp(429, '600'), 0) === null);

// ⑤ jitter 存在（避免多用戶端同步重試造成二次尖峰）
{
  const samples = new Set();
  for(let i = 0; i < 40; i++) samples.add(mod.computeRetryWaitMs(resp(429), 0));
  check('等待時間帶有隨機抖動（40 次取樣出現多個不同值）', samples.size > 5, '相異值 ' + samples.size + ' 個');
  const all = [...samples];
  check('抖動幅度受控（不超過基準值的 1.3 倍）', Math.max(...all) <= 8000 * 1.3);
}

// ⑥ 端對端：fetchWithRetry 真的照新策略走
(async function(){
  // 用假的計時器把等待「記錄下來但不真的睡」，否則測試要跑好幾十秒
  const waited = [];
  const realSetTimeout = setTimeout;
  // 逾時保護用的計時器固定為 900ms，退避等待一律 >1000ms，據此區分兩者；
  // 退避等待只記錄不真的睡，否則這支測試要跑好幾十秒
  const fakeSetTimeout = (fn, ms) => { if(ms > 1000){ waited.push(ms); return realSetTimeout(fn, 0); } return realSetTimeout(fn, ms); };
  const mod2 = new Function('AbortController', 'setTimeout', 'clearTimeout',
    src + '\nreturn {fetchWithRetry};')(AbortController, fakeSetTimeout, clearTimeout);

  let calls = 0;
  const r = await mod2.fetchWithRetry(() => { calls++; return Promise.resolve(calls < 3 ? resp(429, '12') : resp(200)); }, 2, null, null, 900);
  check('連續 429 後重試成功，最終取得 200', r.status === 200 && calls === 3, '共呼叫 ' + calls + ' 次');
  check('兩次重試都等到伺服器指定的 12 秒以上',
    waited.length === 2 && waited.every(w => w >= 12000), '實際等待：' + waited.join(' / ') + ' ms');

  waited.length = 0;
  let calls2 = 0;
  const r2 = await mod2.fetchWithRetry(() => { calls2++; return Promise.resolve(resp(429, '600')); }, 2, null, null, 900);
  check('伺服器要求等 600 秒時立即放棄重試（只打 1 次）', r2.status === 429 && calls2 === 1, '共呼叫 ' + calls2 + ' 次');
  check('放棄重試時完全沒有空等', waited.length === 0);

  waited.length = 0;
  let calls3 = 0;
  const r3 = await mod2.fetchWithRetry(() => { calls3++; return Promise.resolve(resp(400)); }, 2, null, null, 900);
  check('不可重試的狀態碼（400）不會被重試', r3.status === 400 && calls3 === 1);

  console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗\n');
  process.exit(fail ? 1 : 0);
})();
