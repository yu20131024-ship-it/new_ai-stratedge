/* 階段2 驗證：分段生成 + 逐段落地暫存（IndexedDB）
 *
 * 測試方式（遵守鐵律第8條）：直接從 index.html 擷取專案裡真正的
 * hashInputSignature / planAnalysisSegments / mergeAnalysisSegments /
 * AnalysisCheckpoint / runSegmentedAnalysis / buildSystemPrompt 原始碼，
 * 以假的 callAI 與假的 IndexedDB 驅動，不另外重寫一份簡化邏輯。
 *
 * 重點驗證「這次改動最容易出錯、也最有價值的四件事」：
 *   ① 向後相容：非 Agnes 供應商必須維持單次完整分析，行為完全不變
 *   ② 分段後的 JSON 合併結果，形狀必須與單次完整分析一模一樣（下游渲染器才不會壞）
 *   ③ 斷線重續：第二段失敗後重跑，第一段必須讀暫存、不重打 API
 *   ④ 暫存不可用（隱私模式／舊瀏覽器）時，必須仍能正常完成，只是沒有續傳能力
 *
 * 用法：node _project-improvement/tests/stage2-segmented-analysis.test.js
 */
const { readIndex, extractDeclaration, extractDeclarationArr } = require('./lib/extract.js');
const html = readIndex();

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ✅ ' + name + (detail ? '　' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '　' + detail : '')); }
}

// ---------- 極簡 IndexedDB 替身（只實作本專案用到的 API 面） ----------
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
    stats: () => ({ puts: putCount, gets: getCount, keys: [...data.keys()] }),
    data
  };
}

// ---------- 載入真實原始碼 ----------
function loadModule(fakeIdb, fakeWindow){
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
    extractDeclaration(html, 'async function runSegmentedAnalysis(d, plan, usr, hasRealSearch, quickMode, abortSignal){')
  ].join('\n\n');
  const bv = (html.match(/const BENCHMARK_LAST_VERIFIED = '([^']+)'/) || [])[1];
  return new Function(
    'BENCHMARK_LAST_VERIFIED', 'indexedDB', 'window', 'console', 'setTimeout',
    'callAI', 'buildDynamicPromptTail', 'extractJson', 'PROVIDER_LABEL', 'getProvider',
    src + '\nreturn {hashInputSignature, planAnalysisSegments, mergeAnalysisSegments, AnalysisCheckpoint, runSegmentedAnalysis, buildSystemPrompt};'
  )(bv, fakeIdb, fakeWindow, { info(){}, warn(){}, error(){} }, setTimeout,
    fakeWindow.__callAI, (d,q,c,scope)=>'[tail:'+(scope||'full')+']',
    txt => JSON.parse(txt), {}, () => 'agnes');
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

console.log('\n=== 階段2：分段生成與逐段暫存 驗證 ===\n');

// ① 啟用策略（向後相容最重要的一關）
{
  const fi = makeFakeIndexedDB();
  const m = loadModule(fi.api, { __callAI: async()=>({}) });
  const plan = k => m.planAnalysisSegments(D, { provider:k, skillCount:0, baseMaxTokens:13000 });
  check('Claude 維持單次完整分析（既有路徑完全不動）', plan('claude').mode === 'single');
  check('Gemini 維持單次完整分析', plan('gemini').mode === 'single');
  check('Agnes 預設走分段生成', plan('agnes').mode === 'segmented');
  const segs = plan('agnes').segments;
  check('分為 2 段：競品／SWOT 與 五層分析', segs.length === 2 && segs[0].scope === 'market' && segs[1].scope === 'analysis');
  check('單段輸出額度可提升至 11,000 並仍採分段', segs.every(s => s.maxTokens <= 11000),
    segs.map(s => s.label + '=' + s.maxTokens).join('／'));
  check('競品段排在第一個（最容易失敗，先打浪費最少）', segs[0].id === 'market');
  // 技能模組會讓五層分析段的額度成長，但仍受上限保護
  const many = m.planAnalysisSegments(D, { provider:'agnes', skillCount:5, baseMaxTokens:13000 });
  check('勾選多個技能模組時，五層分析段額度成長但受 11,000 上限保護',
    many.segments[1].maxTokens === 11000);
}

// ② runId 穩定性
{
  const m = loadModule(makeFakeIndexedDB().api, { __callAI: async()=>({}) });
  check('同一份輸入產生相同 runId（暫存才命中得到）', m.hashInputSignature(D) === m.hashInputSignature(D));
  check('改動任一輸入即產生不同 runId（不會誤用舊結果）',
    m.hashInputSignature(D) !== m.hashInputSignature(Object.assign({}, D, { budget: 60000 })));
}

// ③ 合併結果形狀必須等同單次完整分析
{
  const m = loadModule(makeFakeIndexedDB().api, { __callAI: async()=>({}) });
  const merged = m.mergeAnalysisSegments([MARKET_JSON, ANALYSIS_JSON]);
  const expectedKeys = ['competitors','perceptualMap','swot','descriptive','diagnostic','predictive','environmental','prescriptive'];
  const missing = expectedKeys.filter(k => !(k in merged));
  check('合併後包含單次完整分析的全部 8 個頂層欄位', missing.length === 0, missing.length ? '缺少：' + missing.join(',') : '');
  check('合併後內容正確未錯位', merged.competitors.intl[0].name === 'A' && merged.prescriptive === '建議');
  const late = m.mergeAnalysisSegments([{ descriptive:'先來的' }, { descriptive: undefined }]);
  check('後段的 undefined 不會洗掉前段已取得的內容', late.descriptive === '先來的');
  const nulled = m.mergeAnalysisSegments([{ perceptualMap:{x:1} }, { perceptualMap:null }]);
  check('後段的 null 不會洗掉前段的實質內容', nulled.perceptualMap && nulled.perceptualMap.x === 1);
}

// ④ 每段 prompt 確實只帶自己用得到的規則
{
  const m = loadModule(makeFakeIndexedDB().api, { __callAI: async()=>({}) });
  const full = m.buildSystemPrompt(D, true);
  const mk = m.buildSystemPrompt(D, true, 'market');
  const an = m.buildSystemPrompt(D, true, 'analysis');
  check('競品段不帶五層分析規則', mk.indexOf('【五層分析結構，依序輸出】') === -1 && mk.indexOf('【競品分析') !== -1);
  check('五層分析段不帶競品查核與來源查證規則',
    an.indexOf('【競品分析') === -1 && an.indexOf('【來源連結查證') === -1 && an.indexOf('【五層分析結構，依序輸出】') !== -1);
  check('五層分析段不帶只為查競品而存在的權威來源類別',
    an.indexOf('findbiz.nat.gov.tw') === -1 && an.indexOf('mops.twse.com.tw') === -1);
  check('競品段的 JSON schema 只要求競品相關欄位',
    mk.indexOf('"competitors"') !== -1 && mk.indexOf('"prescriptive"') === -1);
  check('五層分析段的 JSON schema 只要求五層分析欄位',
    an.indexOf('"prescriptive"') !== -1 && an.indexOf('"competitors"') === -1);
  check('兩段的 prompt 都明顯小於單次完整版',
    mk.length < full.length && an.length < full.length,
    'full=' + full.length + '／market=' + mk.length + '／analysis=' + an.length + ' 字元');
}

// ⑤ 端對端：正常跑完 + 斷線重續 + 暫存不可用
(async function(){
  const plan = (() => {
    const m = loadModule(makeFakeIndexedDB().api, { __callAI: async()=>({}) });
    return m.planAnalysisSegments(D, { provider:'agnes', skillCount:0, baseMaxTokens:13000 });
  })();

  // (a) 正常跑完兩段
  {
    const fi = makeFakeIndexedDB();
    const calls = [];
    const win = { __callAI: async (sys, usr, maxTokens) => {
      const scope = sys.dynamic.indexOf('market') !== -1 ? 'market' : 'analysis';
      calls.push(scope);
      return { text: JSON.stringify(scope === 'market' ? MARKET_JSON : ANALYSIS_JSON),
               citations: [{ url:'https://example.com/' + scope, title:scope }], truncated:false };
    }};
    const m = loadModule(fi.api, win);
    const r = await m.runSegmentedAnalysis(D, plan, 'usr', true, false, null);
    check('兩段依序各打一次 API', calls.join(',') === 'market,analysis', '實際：' + calls.join(' → '));
    check('最終 JSON 與單次完整分析同形狀',
      ['competitors','swot','descriptive','predictive','prescriptive'].every(k => k in r.json));
    check('兩段都寫入了暫存', fi.stats().puts === 2, '寫入 ' + fi.stats().puts + ' 筆');
    check('跨段引用來源已合併', r.citations.length === 2);
  }

  // (b) 第二段失敗 → 重跑時第一段必須讀暫存
  {
    const fi = makeFakeIndexedDB();
    let apiCalls = 0;
    const makeWin = failSecond => ({ __callAI: async (sys) => {
      apiCalls++;
      const scope = sys.dynamic.indexOf('market') !== -1 ? 'market' : 'analysis';
      if(scope === 'analysis' && failSecond) throw new Error('network_error: 模擬第二段斷線');
      return { text: JSON.stringify(scope === 'market' ? MARKET_JSON : ANALYSIS_JSON), citations:[], truncated:false };
    }});

    let threw = false;
    try{ await loadModule(fi.api, makeWin(true)).runSegmentedAnalysis(D, plan, 'usr', true, false, null); }
    catch(e){ threw = true; }
    check('第二段失敗時確實往上拋出錯誤（不會假裝成功）', threw);
    check('第一段的成果已先落地暫存', fi.stats().puts === 1 && fi.stats().keys[0].indexOf('::market') !== -1);

    const before = apiCalls;
    const r2 = await loadModule(fi.api, makeWin(false)).runSegmentedAnalysis(D, plan, 'usr', true, false, null);
    check('重跑時只重打失敗的那一段（第一段命中暫存）', apiCalls - before === 1, '重跑共打 ' + (apiCalls - before) + ' 次 API');
    check('重跑後結果依然完整', r2.json.competitors && r2.json.prescriptive === '建議');
  }

  // (c) 暫存完全不可用時仍須正常完成
  {
    let apiCalls = 0;
    const brokenIdb = { open: () => { throw new Error('indexeddb blocked'); } };
    const win = { __callAI: async (sys) => {
      apiCalls++;
      const scope = sys.dynamic.indexOf('market') !== -1 ? 'market' : 'analysis';
      return { text: JSON.stringify(scope === 'market' ? MARKET_JSON : ANALYSIS_JSON), citations:[], truncated:false };
    }};
    const m = loadModule(brokenIdb, win);
    const r = await m.runSegmentedAnalysis(D, plan, 'usr', true, false, null);
    check('IndexedDB 不可用（隱私模式）時分析仍正常完成，只是沒有續傳能力',
      apiCalls === 2 && !!r.json.competitors && !!r.json.prescriptive);
  }

  // (d) 進度回呼
  {
    const fi = makeFakeIndexedDB();
    const events = [];
    const win = {
      _onAiSegment: (i, total, label, state) => events.push(i + '/' + total + ':' + state),
      __callAI: async (sys) => ({ text: JSON.stringify(sys.dynamic.indexOf('market') !== -1 ? MARKET_JSON : ANALYSIS_JSON), citations:[], truncated:false })
    };
    await loadModule(fi.api, win).runSegmentedAnalysis(D, plan, 'usr', true, false, null);
    check('逐段回報進度，供進度條逐段亮起', events.join(',') === '1/2:start,1/2:done,2/2:start,2/2:done', events.join(' '));
  }

  console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗\n');
  process.exit(fail ? 1 : 0);
})();
