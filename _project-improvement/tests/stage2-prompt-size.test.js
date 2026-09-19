/* 階段2 驗證：System Prompt 依「勾選管道 × 產業別」動態組裝，實測 token 耗量下降。
 *
 * 測試方式（遵守鐵律第8條）：直接從 index.html 擷取「專案裡真正的」
 * PLATFORM_BENCHMARK_DB / INDUSTRY_BENCHMARK_BUCKET / selectBenchmarkPlatforms /
 * buildBenchmarkSection / buildSystemPrompt 原始碼，在 Node 中求值後實際呼叫，
 * 不另外重寫一份簡化邏輯。
 *
 * 用法：node _project-improvement/tests/stage2-prompt-size.test.js
 */
const path = require('path');
const fs = require('fs');
const { readIndex, extractDeclaration, extractDeclarationArr } = require('./lib/extract.js');

const html = readIndex();

// ---- 載入真實原始碼 ----
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
  extractDeclaration(html, 'function buildSystemPrompt(d, hasRealSearch')
].join('\n\n');
const BENCHMARK_LAST_VERIFIED = (html.match(/const BENCHMARK_LAST_VERIFIED = '([^']+)'/) || [])[1];
const mod = new Function('BENCHMARK_LAST_VERIFIED',
  src + '\nreturn {selectBenchmarkPlatforms, buildBenchmarkSection, buildSystemPrompt, PLATFORM_BENCHMARK_DB, selectAuthoritySources, AUTHORITY_SOURCE_CATEGORIES};'
)(BENCHMARK_LAST_VERIFIED);

// ---- 測試用輸入（對應 index.html 內真實的 channel value 與 industry value）----
function input(over){
  return Object.assign({
    orgType: 'company', industry: 'other', industryLabel: '其他',
    channels: ['Facebook / Instagram', 'Google 搜尋廣告', 'LINE 官方帳號']
  }, over || {});
}
// 粗估 token：中文約 1 字元 ≈ 0.6-1 token，此處採保守的 1 字元 = 0.75 token
const estTokens = s => Math.round(s.length * 0.75);

let pass = 0, fail = 0;
function check(name, cond, detail){
  if(cond){ pass++; console.log('  ✅ ' + name + (detail ? '　' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '　' + detail : '')); }
}

console.log('\n=== 階段2：System Prompt 動態組裝驗證 ===\n');

// 1) 預設情境（FB/IG + Google + LINE，其他產業）
const d1 = input();
const p1 = mod.buildSystemPrompt(d1, true);
console.log('[情境1] 預設勾選（FB/IG、Google 搜尋、LINE）／產業=其他');
console.log('  system prompt 長度：' + p1.length + ' 字元（估 ' + estTokens(p1) + ' tokens）');
check('只組進 Meta 與 Google 兩張基準表', p1.indexOf('TikTok Ads 基準') === -1 && p1.indexOf('Email 基準') === -1 && p1.indexOf('Meta Ads 基準') !== -1 && p1.indexOf('Google Ads 基準') !== -1);
check('未涵蓋的產業別有誠實標註', p1.indexOf('基準數據庫未涵蓋') !== -1);

// 2) 電商全管道
const d2 = input({industry:'retail_ecommerce', industryLabel:'零售電商', channels:['Facebook / Instagram','Google 搜尋廣告','TikTok','Email Marketing']});
const p2 = mod.buildSystemPrompt(d2, true);
console.log('[情境2] 全付費管道／產業=零售電商');
console.log('  system prompt 長度：' + p2.length + ' 字元（估 ' + estTokens(p2) + ' tokens）');
check('四張基準表全數組入', ['Meta Ads 基準','Google Ads 基準','TikTok Ads 基準','Email 基準'].every(k=>p2.indexOf(k)!==-1));
check('只帶電商產業細項、未夾帶 B2B 細項', p2.indexOf('電商 CPC 約$0.67') !== -1 && p2.indexOf('B2B 通用類別轉換率') === -1);

// 3) 只勾 TikTok 的美妝品牌
const d3 = input({industry:'beauty', industryLabel:'美妝保養', channels:['TikTok']});
const p3 = mod.buildSystemPrompt(d3, true);
console.log('[情境3] 只勾 TikTok／產業=美妝保養');
console.log('  system prompt 長度：' + p3.length + ' 字元（估 ' + estTokens(p3) + ' tokens）');
check('只組進 TikTok 一張表', p3.indexOf('TikTok Ads 基準') !== -1 && p3.indexOf('Meta Ads 基準') === -1 && p3.indexOf('Google Ads 基準') === -1);
check('帶入美妝產業細項', p3.indexOf('零售、美妝類別 CPC 偏低') !== -1);

// 4) 只勾 LINE／KOL（無對應基準表）→ 回退為代理基準且誠實說明
const d4 = input({channels:['LINE 官方帳號','KOL / 網紅合作']});
const p4 = mod.buildSystemPrompt(d4, true);
check('無對應基準表時回退 Meta+Google 並標示為代理基準', p4.indexOf('代理參考') !== -1 && p4.indexOf('Meta Ads 基準') !== -1);

// 5) 無搜尋工具版本（Agnes 路徑）——這是 429 最嚴重的路徑
const p5 = mod.buildSystemPrompt(d1, false);
console.log('[情境5] 無搜尋工具（Agnes 路徑）／預設勾選');
console.log('  system prompt 長度：' + p5.length + ' 字元（估 ' + estTokens(p5) + ' tokens）');
check('無搜尋工具時不得夾帶十大權威來源清單', p5.indexOf('權威資料來源優先順序') === -1);

// 6a) 對照 v2.3.30（全量塞入）的實測基準值——寫死在測試裡，確保任何環境都會驗證「縮減沒有被改回去」
const V2330_BASELINE = { withSearch: 14291, withoutSearch: 8815 };
check('有搜尋工具路徑相對 v2.3.30 縮減 ≥10%',
  p1.length <= V2330_BASELINE.withSearch * 0.90,
  V2330_BASELINE.withSearch + ' → ' + p1.length + ' 字元（-' + ((1 - p1.length / V2330_BASELINE.withSearch) * 100).toFixed(1) + '%）');
check('無搜尋工具（Agnes）路徑相對 v2.3.30 有縮減',
  p5.length < V2330_BASELINE.withoutSearch,
  V2330_BASELINE.withoutSearch + ' → ' + p5.length + ' 字元（-' + ((1 - p5.length / V2330_BASELINE.withoutSearch) * 100).toFixed(1) + '%）');

// 6b) 若有提供改版前檔案（BEFORE_INDEX 環境變數），再做一次即時對照
const beforeFile = process.env.BEFORE_INDEX;
if(beforeFile && fs.existsSync(beforeFile)){
  const oldHtml = fs.readFileSync(beforeFile, 'utf8');
  const oldFn = new Function(extractDeclaration(oldHtml, 'function buildSystemPrompt(d, hasRealSearch){') + '\nreturn buildSystemPrompt;')();
  const o1 = oldFn(d1, true), o5 = oldFn(d1, false);
  const drop1 = ((o1.length - p1.length) / o1.length * 100).toFixed(1);
  const drop5 = ((o5.length - p5.length) / o5.length * 100).toFixed(1);
  console.log('[對照] 改版前 → 改版後');
  console.log('  有搜尋工具：' + o1.length + ' → ' + p1.length + ' 字元（-' + drop1 + '%）');
  console.log('  無搜尋工具：' + o5.length + ' → ' + p5.length + ' 字元（-' + drop5 + '%）');
  check('靜態 system prompt 確實縮減', p1.length < o1.length && p5.length < o5.length);
}

// 6c) 向後相容鐵則：不傳 scope 必須等同 scope='full'，且完整版不可漏掉任何一段規則
{
  const SECTIONS = ['【核心原則','【產業基準數據庫','【行銷知識框架','【經營主體類型對競品搜尋策略的影響',
    '【競品「存續狀態」查核','【競品分析','【來源連結查證','【SWOT 分析','【時間軸絕不可一刀切',
    '【全漏斗活動架構','【五層分析結構，依序輸出','【輸出格式','【JSON 格式鐵則'];
  for(const hs of [true, false]){
    const implicit = mod.buildSystemPrompt(d2, hs);
    const explicit = mod.buildSystemPrompt(d2, hs, 'full');
    check('不傳 scope 與 scope=\'full\' 輸出逐字相同（hasRealSearch=' + hs + '）', implicit === explicit);
    const missing = SECTIONS.filter(k => implicit.indexOf(k) === -1);
    check('完整版仍包含全部 ' + SECTIONS.length + ' 個規則段落（hasRealSearch=' + hs + '）',
      missing.length === 0, missing.length ? '缺少：' + missing.join(',') : '');
  }
  // 完整版的 JSON schema 必須涵蓋全部 8 個頂層欄位，一個都不能因為分段改動而掉
  const fullPrompt = mod.buildSystemPrompt(d2, true, 'full');
  const FIELDS = ['"competitors"','"perceptualMap"','"swot"','"descriptive"','"diagnostic"','"predictive"','"environmental"','"prescriptive"'];
  const lostFields = FIELDS.filter(f => fullPrompt.indexOf(f) === -1);
  check('完整版 JSON schema 仍要求全部 8 個頂層欄位', lostFields.length === 0,
    lostFields.length ? '缺少：' + lostFields.join(',') : '');
}

// 7) 迴歸保護：所有基準數字不得在搬成結構化資料的過程中遺失
const allText = Object.keys(mod.PLATFORM_BENCHMARK_DB).map(k=>{
  const p = mod.PLATFORM_BENCHMARK_DB[k];
  return [p.source, p.overall].concat(Object.values(p.byIndustry)).join(' ');
}).join(' ');
const MUST_KEEP = ['1.55%-2.19%','$0.70-0.78','$0.67','$30-38','$25-35','0.78%','$2.50-3.77','$90-120',
  '6.64%','$5.42','3.75%-8.18%','$66.69','$1.16','1.42%','$8.50-14.00','$4-13','$13.26','$4.80',
  '0.5%-1.8%','$0.3-1.5','$0.74-0.79','$1.7-1.9','0.46%-2.5%','$32.74','8.6%','30%-47%','1.3%-2.4%','31%','1.69%','34%','1.8%'];
const lost = MUST_KEEP.filter(v => allText.indexOf(v) === -1);
check('原始基準數字 ' + MUST_KEEP.length + ' 項全數保留（無遺失）', lost.length === 0, lost.length ? '遺失：' + lost.join(',') : '');

console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗\n');
process.exit(fail ? 1 : 0);
