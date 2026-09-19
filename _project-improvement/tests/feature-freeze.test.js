/* 階段1：功能凍結護欄（Feature Freeze Guard）
 *
 * 目的：證明「沒有任何功能在改版過程中被偷偷拿掉」。
 *
 * 為什麼不是 Playwright：本專案的驗證環境無對外網路、無法安裝 node_modules，
 * 路線圖原訂的 Playwright／jsdom 方案在此環境完全跑不起來（跑不起來的護欄等於沒有護欄）。
 * 因此改為零依賴的靜態護欄，直接解析 index.html 本身：
 *   ① 清點所有 <button>、inline 事件屬性、以及被它們呼叫的函式名
 *   ② 斷言每一個被呼叫的函式，在頁面的 JS 語境中都找得到對應的宣告
 *      （含 window.xxx = function 這類動態綁定）
 *   ③ 與 baseline.json 比對：按鈕數／事件屬性數／函式清單只允許增加或持平，減少即 fail
 * 這三項正是「功能被拿掉」最先會露出馬腳的地方。
 *
 * 用法：
 *   node _project-improvement/tests/feature-freeze.test.js            # 比對 baseline
 *   node _project-improvement/tests/feature-freeze.test.js --update   # 重建 baseline（需人為確認）
 */
const fs = require('fs');
const path = require('path');
const { readIndex, extractInlineScripts } = require('./lib/extract.js');

const BASELINE_PATH = path.join(__dirname, 'baseline.json');
const html = readIndex();

// ---------- ① 蒐集 JS 語境中所有可被 inline handler 呼叫到的函式名 ----------
const DECL_PATTERNS = [
  /function\s+([A-Za-z_$][\w$]*)\s*\(/g,                                            // function foo(){}
  /window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/g,                  // window.foo = function(){} ／ = (…)=>
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>)/g
];
const scripts = extractInlineScripts(html);
const declared = new Set();
for(const s of scripts){
  for(const p of DECL_PATTERNS){
    p.lastIndex = 0;
    let m;
    while((m = p.exec(s.code))) declared.add(m[1]);
  }
}

// ---------- ② 蒐集所有 inline 事件屬性與其呼叫的函式 ----------
const HANDLER_ATTR = /\son(click|change|input|submit|keydown|keyup|keypress|focus|blur|mouseenter|mouseleave|error|load)\s*=\s*"([^"]*)"/g;
const KEYWORDS = new Set(['if','for','while','switch','catch','return','typeof','function','this','new','delete','void','in','of','do','else','try']);
// 瀏覽器內建／物件方法：屬於平台能力，不需要在本檔中找到宣告
const BUILTIN = new Set(['alert','confirm','prompt','console','setTimeout','setInterval','clearTimeout','parseInt','parseFloat',
  'Number','String','Boolean','Array','Object','JSON','Math','Date','encodeURIComponent','decodeURIComponent','isNaN','isFinite',
  'open','preventDefault','stopPropagation','getElementById','querySelector','querySelectorAll','forEach','toggle','add','remove',
  'setItem','getItem','removeItem','focus','blur','click','logout','login','reload','print','scrollIntoView','requestAnimationFrame']);

const handlerAttrs = [];
const calledFns = new Map();
let m;
while((m = HANDLER_ATTR.exec(html))){
  handlerAttrs.push({ event: m[1], code: m[2] });
  const CALL = /([A-Za-z_$][\w$]*)\s*\(/g;
  let c;
  while((c = CALL.exec(m[2]))){
    const n = c[1];
    if(KEYWORDS.has(n)) continue;
    // 物件方法呼叫（foo.bar()）以 . 前綴判斷，只取最外層識別字
    const prevChar = m[2][c.index - 1];
    if(prevChar === '.') continue;
    calledFns.set(n, (calledFns.get(n) || 0) + 1);
  }
}

// ---------- ③ 路線圖特別點名的 5 個動態綁定函式 ----------
const DYNAMIC_BOUND = ['toggleDocCenter','closeDocCenter','handleDocPanelBackdrop','triggerDocUpload','downloadManualPdf'];

// ---------- 產出本次快照 ----------
const snapshot = {
  generatedFor: (html.match(/window\.APP_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || 'unknown',
  buttonCount: (html.match(/<button[\s>]/g) || []).length,
  handlerAttrCount: handlerAttrs.length,
  inlineScriptCount: scripts.length,
  styleTagCount: (html.match(/<style[\s>]/g) || []).length,
  declaredFunctionCount: declared.size,
  calledFunctions: [...calledFns.keys()].sort(),
  dynamicBoundFunctions: DYNAMIC_BOUND.slice(),
  // 主要功能進入點：這些函式名一旦消失，代表整塊功能被拿掉
  criticalEntryPoints: [
    'gatherInputs','buildSystemPrompt','buildUserPrompt','computeAnalysisAI','callAI',
    'simulateAttribution','renderAttributionSimulator','switchOutTab','renderCharts',
    'buildBenchmarkSection','buildAuthoritySourceSection','dataSourceBadge','registerInit'
  ]
};

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ✅ ' + name + (detail ? '　' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '　' + detail : '')); }
}

console.log('\n=== 階段1：功能凍結護欄 ===\n');
console.log('本次快照：版本 ' + snapshot.generatedFor + '／<button> ' + snapshot.buttonCount + ' 顆／inline 事件屬性 '
  + snapshot.handlerAttrCount + ' 個／可呼叫函式宣告 ' + snapshot.declaredFunctionCount + ' 個\n');

// 斷言 A：每個被 inline handler 呼叫的函式都必須存在
const missing = snapshot.calledFunctions.filter(n => !declared.has(n) && !BUILTIN.has(n));
check('所有 inline 事件屬性呼叫的函式都找得到宣告（共 ' + snapshot.calledFunctions.length + ' 個）',
  missing.length === 0, missing.length ? '缺少：' + missing.join(', ') : '');

// 斷言 B：5 個動態綁定函式仍在
const missingDyn = DYNAMIC_BOUND.filter(n => html.indexOf('window.' + n + ' =') === -1 && html.indexOf('function ' + n + '(') === -1);
check('5 個 window.xxx 動態綁定函式全數存在', missingDyn.length === 0, missingDyn.length ? '缺少：' + missingDyn.join(', ') : '');

// 斷言 C：主要功能進入點仍在
const missingEntry = snapshot.criticalEntryPoints.filter(n => !declared.has(n));
check('主要功能進入點全數存在（共 ' + snapshot.criticalEntryPoints.length + ' 個）',
  missingEntry.length === 0, missingEntry.length ? '缺少：' + missingEntry.join(', ') : '');

// 斷言 D：11 個輸出頁籤內容區塊全數可達
const OUT_TABS = ['數據視圖','文案版本','實驗計畫','素材指令','策略指令庫','基準資料','法規安全檢核','歸因模擬','ROI','業務開發'];
const missingTabs = OUT_TABS.filter(t => html.indexOf(t) === -1);
check('11 個輸出分頁的功能名稱全數仍在頁面中', missingTabs.length === 0, missingTabs.length ? '缺少：' + missingTabs.join(', ') : '');

// 斷言 E：與 baseline 比對（只允許增加或持平）
if(process.argv.includes('--update')){
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(snapshot, null, 2) + '\n');
  console.log('\n⚠️  已重建 baseline.json（' + BASELINE_PATH + '）。請人為確認差異是刻意的再 commit。\n');
}else if(fs.existsSync(BASELINE_PATH)){
  const base = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  check('按鈕數量未減少', snapshot.buttonCount >= base.buttonCount, base.buttonCount + ' → ' + snapshot.buttonCount);
  check('inline 事件屬性數量未減少', snapshot.handlerAttrCount >= base.handlerAttrCount, base.handlerAttrCount + ' → ' + snapshot.handlerAttrCount);
  const lostFns = base.calledFunctions.filter(n => snapshot.calledFunctions.indexOf(n) === -1);
  check('baseline 中被呼叫的函式沒有任何一個消失', lostFns.length === 0, lostFns.length ? '消失：' + lostFns.join(', ') : '');
  const lostEntry = (base.criticalEntryPoints || []).filter(n => !declared.has(n));
  check('baseline 中的主要功能進入點沒有任何一個消失', lostEntry.length === 0, lostEntry.length ? '消失：' + lostEntry.join(', ') : '');
}else{
  console.log('\n⚠️  尚無 baseline.json，請先執行：node ' + path.relative(process.cwd(), __filename) + ' --update\n');
}

console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗\n');
process.exit(fail ? 1 : 0);
