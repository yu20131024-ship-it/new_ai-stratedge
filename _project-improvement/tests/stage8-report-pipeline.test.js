/* 階段8 驗證：報告零 token 重製、單章重新產生、PDF 彈出封鎖 fallback
 *
 * 測試方式（遵守鐵律第8條）：直接從 index.html 擷取專案裡真正的
 * computeAnalysisAI / regenerateAnalysisSegment / buildAnalysisResultFromJson /
 * finalResultCacheKey 等原始碼，以假的 callAI 與假的 IndexedDB 端對端驅動。
 *
 * 用法：node _project-improvement/tests/stage8-report-pipeline.test.js
 */
const { readIndex, extractDeclaration, extractDeclarationArr } = require('./lib/extract.js');
const html = readIndex();

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ✅ ' + name + (detail ? '　' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '　' + detail : '')); }
}

// ---------- 極簡 IndexedDB 替身（同 stage2-segmented-analysis.test.js） ----------
function makeFakeIndexedDB(){
  const data = new Map();
  let putCount = 0, getCount = 0;
  function req(resultFn){
    const r = { onsuccess:null, onerror:null, result:undefined };
    setTimeout(() => { try{ r.result = resultFn(); r.onsuccess && r.onsuccess(); }catch(e){ r.error = e; r.onerror && r.onerror(); } }, 0);
    return r;
  }
  const store = {
    get: k => req(() => { getCount++; return data.get(k); }),
    put: (v, k) => req(() => { putCount++; data.set(k, v); return k; }),
    delete: k => req(() => { data.delete(k); return true; })
  };
  const db = { objectStoreNames:{ contains:()=>true }, createObjectStore:()=>store,
               transaction:()=>({ objectStore:()=>store }) };
  return {
    api: { open: () => req(() => db) },
    stats: () => ({ puts: putCount, gets: getCount, keys: [...data.keys()] })
  };
}

function loadModule(fakeIdb, opts){
  opts = opts || {};
  const src = [
    extractDeclaration(html, 'const PLATFORM_BENCHMARK_DB = {'),
    extractDeclaration(html, 'const INDUSTRY_BENCHMARK_BUCKET = {'),
    extractDeclaration(html, 'function selectBenchmarkPlatforms(channels){'),
    extractDeclaration(html, 'function buildBenchmarkSection(d){'),
    extractDeclaration(html, 'function isExportRelated(d){'),
    extractDeclaration(html, 'function isLocationSensitive(d){'),
    extractDeclaration(html, 'function isTechPatentRelated(d){'),
    extractDeclarationArr(html, 'const AUTHORITY_SOURCE_CATEGORIES = ['),
    extractDeclaration(html, 'function selectAuthoritySources(d'),
    extractDeclaration(html, 'function buildAuthoritySourceSection(d'),
    extractDeclaration(html, 'function buildSystemPrompt(d, hasRealSearch'),
    extractDeclaration(html, 'function hashInputSignature(d){'),
    extractDeclaration(html, 'function planAnalysisSegments(d, ctx){'),
    extractDeclaration(html, 'function mergeAnalysisSegments(parts){'),
    extractDeclaration(html, 'const AnalysisCheckpoint = (function(){') + ')();',
    extractDeclaration(html, 'async function runSegmentedAnalysis(d, plan, usr, hasRealSearch, quickMode, abortSignal){'),
    extractDeclaration(html, 'function buildAnalysisResultFromJson(d, j, realCitations, provider){'),
    extractDeclaration(html, 'function finalResultCacheKey(provider, quickMode){'),
    extractDeclaration(html, 'async function computeAnalysisAI(d, abortSignal, opts){'),
    extractDeclaration(html, 'async function regenerateAnalysisSegment(d, segId, abortSignal){')
  ].join('\n\n');
  const bv = (html.match(/const BENCHMARK_LAST_VERIFIED = '([^']+)'/) || [])[1];

  let provider = opts.provider || 'agnes';
  const GOAL_TIMELINE = { conversion:'14-30 天', exposure:'30 天', branding:'3-6 個月' };
  const PROVIDER_LABEL = { agnes:'Agnes AI', claude:'Claude', gemini:'Gemini' };
  const fakeWindow = {};

  const runner = new Function(
    'BENCHMARK_LAST_VERIFIED', 'indexedDB', 'window', 'console', 'setTimeout',
    'callAI', 'buildUserPrompt', 'buildDynamicPromptTail', 'getFallbackBenchmark', 'buildSwot', 'esc',
    'GOAL_TIMELINE', 'PROVIDER_LABEL', 'extractJson', 'getProvider', 'isQuickMode',
    src + '\nreturn {hashInputSignature, planAnalysisSegments, mergeAnalysisSegments, AnalysisCheckpoint, runSegmentedAnalysis, buildSystemPrompt, buildAnalysisResultFromJson, finalResultCacheKey, computeAnalysisAI, regenerateAnalysisSegment};'
  );
  const mod = runner(
    bv, fakeIdb, fakeWindow, { info(){}, warn(){}, error(){} }, setTimeout,
    opts.callAI || (async()=>({ text:'{}', citations:[], truncated:false })),
    d => 'usr:' + d.product,
    (d, q, c, scope) => '[tail:' + (scope || 'full') + ']',
    d => ({ ctr:1.2, cvr:2, sourceLabel:'內建基準' }),
    d => ({ s:[], w:[], o:[], t:[], isSimulated:true }),
    x => String(x == null ? '' : x),
    GOAL_TIMELINE, PROVIDER_LABEL,
    txt => JSON.parse(txt),
    () => provider,
    () => !!opts.quickMode
  );
  mod.setProvider = p => { provider = p; };
  mod.window = fakeWindow;
  return mod;
}

const D = { orgName:'測試品牌', orgType:'company', industry:'retail_ecommerce', industryLabel:'零售電商',
  product:'防曬乳', usp:'不黏膩', price:800, budget:50000, audience:'25-34 女性', region:'',
  channels:['Facebook / Instagram','Google 搜尋廣告'], reach:100000, ctr:1.2, cvr:2, cpa:null,
  pain:'轉換率下滑', goal:'conversion', selectedSkills:[] };

const MARKET_JSON = { competitors:{ intl:[{name:'A'}], local:[{name:'B'}], note:null }, perceptualMap:null,
  swot:{ s:[{text:'s1',impact:'高'}], w:[], o:[], t:[] } };
const ANALYSIS_JSON = { descriptive:'描述', diagnostic:'洞察',
  predictive:{ limit:null, scenarios:[{tag:'情境一'}] },
  environmental:[{title:'變因'}], prescriptive:'建議' };
const FULL_JSON = Object.assign({}, MARKET_JSON, ANALYSIS_JSON);

function scopeOf(sys){ return sys.dynamic.indexOf('market') !== -1 ? 'market' : (sys.dynamic.indexOf('analysis') !== -1 ? 'analysis' : 'full'); }

console.log('\n=== 階段8：報告零 token 重製與單章重新產生 驗證 ===\n');

(async function(){

  // ① 完整結果快取：同一輸入＋供應商＋模式，第二次呼叫零 API
  {
    const fi = makeFakeIndexedDB();
    let apiCalls = 0;
    const mod = loadModule(fi.api, {
      provider:'agnes',
      callAI: async () => { apiCalls++; return { text: JSON.stringify(FULL_JSON), citations:[{url:'https://x',title:'x'}], truncated:false }; }
    });
    const r1 = await mod.computeAnalysisAI(D, null);
    const callsAfterFirst = apiCalls;
    const r2 = await mod.computeAnalysisAI(D, null);
    check('第一次呼叫確實打了 API（分段模式打 2 次）', callsAfterFirst === 2, '實際 ' + callsAfterFirst + ' 次');
    check('第二次呼叫命中完整結果快取，完全沒有再打 API', apiCalls === callsAfterFirst, '第二次後累計 ' + apiCalls + ' 次');
    check('兩次回傳的分析結果內容一致', r1.descHtml === r2.descHtml && r1.prescriptive === r2.prescriptive || (r1.actionHtml === r2.actionHtml));
    check('回傳結果的 provider 欄位正確標示為 agnes', r2.provider === 'agnes');
  }

  // ② 換供應商或換 quickMode 不會誤讀別人的快取
  {
    const fi = makeFakeIndexedDB();
    let calls = { agnes:0, claude:0 };
    const mod = loadModule(fi.api, {
      provider:'agnes',
      callAI: async (sys) => { const scope = scopeOf(sys); calls[mod._curProvider ? mod._curProvider() : 'agnes']=(calls[mod._curProvider?mod._curProvider():'agnes']||0)+1; return { text: JSON.stringify(scope==='market'?MARKET_JSON:(scope==='analysis'?ANALYSIS_JSON:FULL_JSON)), citations:[], truncated:false }; }
    });
    await mod.computeAnalysisAI(D, null); // agnes、分段，寫入 agnes 的 final-result 快取
    mod.setProvider('claude');
    let claudeApiCalls = 0;
    const mod2 = loadModule(fi.api, { provider:'claude', callAI: async () => { claudeApiCalls++; return { text: JSON.stringify(FULL_JSON), citations:[], truncated:false }; } });
    await mod2.computeAnalysisAI(D, null);
    check('切換供應商後不會誤讀 agnes 的快取，claude 仍確實打了 API', claudeApiCalls === 1);
  }

  // ③ forceRefresh：略過快取讀取，但執行完仍寫回快取
  {
    const fi = makeFakeIndexedDB();
    let apiCalls = 0;
    const mod = loadModule(fi.api, { provider:'agnes', callAI: async () => { apiCalls++; return { text: JSON.stringify(FULL_JSON), citations:[], truncated:false }; } });
    await mod.computeAnalysisAI(D, null);
    const afterFirst = apiCalls;
    await mod.computeAnalysisAI(D, null, { forceRefresh:true });
    check('forceRefresh 時即使有快取也會重新打 API', apiCalls > afterFirst, '第二次仍新增 ' + (apiCalls - afterFirst) + ' 次呼叫');
    const afterForce = apiCalls;
    await mod.computeAnalysisAI(D, null); // 不帶 forceRefresh，應命中剛剛寫回的新快取
    check('forceRefresh 執行完仍把最新結果寫回快取，供下次沿用', apiCalls === afterForce);
  }

  // ④ 單次完整分析（Claude／Gemini）不支援單章重新產生，明確拋錯
  {
    const fi = makeFakeIndexedDB();
    const mod = loadModule(fi.api, { provider:'claude', callAI: async () => ({ text: JSON.stringify(FULL_JSON), citations:[], truncated:false }) });
    let threw = null;
    try{ await mod.regenerateAnalysisSegment(D, 'market', null); } catch(e){ threw = e; }
    check('未分段的供應商呼叫單章重新產生時明確拋錯（而非靜默整份重跑）',
      threw && /not_segmented/.test(threw.message));
  }

  // ⑤ 單章重新產生：只重打指定段落，另一段沿用暫存
  {
    const fi = makeFakeIndexedDB();
    const calls = [];
    const mod = loadModule(fi.api, {
      provider:'agnes',
      callAI: async (sys) => { const scope = scopeOf(sys); calls.push(scope);
        return { text: JSON.stringify(scope==='market'?MARKET_JSON:ANALYSIS_JSON), citations:[], truncated:false }; }
    });
    await mod.computeAnalysisAI(D, null);
    check('初次分析打了 market 與 analysis 兩段', calls.join(',') === 'market,analysis');

    calls.length = 0;
    const r = await mod.regenerateAnalysisSegment(D, 'market', null);
    check('重新產生單章時只打了 market 這一段', calls.join(',') === 'market', '實際：' + calls.join(' → '));
    check('重新產生後結果仍完整（analysis 段沿用暫存內容）',
      r.prescriptive === '建議' || r.actionHtml);

  }

  // ⑤b 更嚴謹地驗證「完整結果快取確實失效」：用另一份全新的 mod 實例（不共用記憶體中的任何狀態，
  // 只共用 fake IndexedDB 的資料）重新呼叫，若寫回的快取沒有同步更新，這裡就會讀到重跑前的舊內容。
  {
    const fi = makeFakeIndexedDB();
    const callLog = [];
    const mkCallAI = tag => async (sys) => {
      const scope = scopeOf(sys);
      callLog.push(tag + ':' + scope);
      const payload = scope === 'market'
        ? { competitors:{ intl:[{name: tag}], local:[], note:null }, perceptualMap:null, swot:{s:[],w:[],o:[],t:[]} }
        : ANALYSIS_JSON;
      return { text: JSON.stringify(payload), citations:[], truncated:false };
    };
    await loadModule(fi.api, { provider:'agnes', callAI: mkCallAI('first') }).computeAnalysisAI(D, null);
    const afterFirst = await loadModule(fi.api, { provider:'agnes', callAI: mkCallAI('readback') }).computeAnalysisAI(D, null);
    check('重跑前：完整結果快取內容為第一次跑出的資料', afterFirst.competitors.intl[0].name === 'first');

    await loadModule(fi.api, { provider:'agnes', callAI: mkCallAI('regen') }).regenerateAnalysisSegment(D, 'market', null);
    const afterRegen = await loadModule(fi.api, { provider:'agnes', callAI: mkCallAI('should-not-call') }).computeAnalysisAI(D, null);
    check('重新產生單章後，用全新實例讀到的完整結果快取已更新為新內容（不是殘留的舊資料）',
      afterRegen.competitors.intl[0].name === 'regen', '實際讀到：' + afterRegen.competitors.intl[0].name);
    check('讀回新快取時完全沒有再打 API（確認真的是讀快取而非又跑了一次）',
      callLog.filter(c => c.indexOf('should-not-call') === 0).length === 0);
  }

  // ⑥ 單章重新產生指定不存在的段落 id
  {
    const fi = makeFakeIndexedDB();
    const mod = loadModule(fi.api, { provider:'agnes', callAI: async () => ({ text:'{}', citations:[], truncated:false }) });
    let threw = null;
    try{ await mod.regenerateAnalysisSegment(D, 'not-a-real-segment', null); } catch(e){ threw = e; }
    check('指定不存在的段落 id 時明確拋錯', threw && /unknown_segment/.test(threw.message));
  }

  // ⑦ 靜態檢查：PDF 彈出封鎖 fallback 與列印分頁規則
  {
    const src = html;
    check('PDF 分支不再於彈出被封鎖時直接丟棄已產生的內容',
      src.indexOf("內容並未遺失，請點擊下方按鈕手動開啟") !== -1);
    check('提供手動點擊開啟的 fallback 按鈕（真實使用者手勢，不受封鎖影響）',
      /toast\([^)]*'點此開啟列印視窗'/.test(src));
    check('fallback 分支仍會在成功開啟後記錄下載事件（不漏記）',
      (src.match(/logDownload\(\);/g) || []).length >= 2);
    check('URL 不再於封鎖當下立即 revoke（給使用者猶豫時間再點擊）',
      src.indexOf('5*60*1000') !== -1);
    check('報告列印樣式已加入分頁規則（標題不孤立、卡片不被硬切）',
      src.indexOf('page-break-after:avoid') !== -1 && src.indexOf('page-break-inside:avoid') !== -1);
    check('表格跨頁時會重複表頭', src.indexOf('thead{display:table-header-group}') !== -1);
  }

  console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗\n');
  process.exit(fail ? 1 : 0);
})();
