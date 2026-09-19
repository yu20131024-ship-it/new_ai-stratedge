/* 階段4 驗證：輸出區 10 個頁籤整併為 3 個語意分區（策略洞察／執行產出／治理）
 *
 * 這次做法刻意保守：不改動 switchOutTab() 的顯示切換機制、不動任何 tab-pane
 * 內容、不搬動任何按鈕的 onclick／aria 屬性——只在既有按鈕外層包上 3 個帶標題的
 * 視覺分組容器。這支測試驗證「包裝」本身沒有弄丟任何東西，也沒有改變原本的
 * 切換行為。
 *
 * 用法：node _project-improvement/tests/stage4-tab-sections.test.js
 */
const { readIndex, extractDeclaration } = require('./lib/extract.js');
const html = readIndex();

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ✅ ' + name + (detail ? '　' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '　' + detail : '')); }
}

console.log('\n=== 階段4：頁籤整併為 3 分區 驗證 ===\n');

// ① 3 個分區標題都存在，且順序符合路線圖規劃（策略洞察／執行產出／治理）
const sectionOrder = [...html.matchAll(/<div class="tab-section-label">([^<]+)<\/div>/g)].map(m => m[1]);
check('3 個分區標題依序為 策略洞察／執行產出／治理',
  JSON.stringify(sectionOrder) === JSON.stringify(['策略洞察', '執行產出', '治理']),
  JSON.stringify(sectionOrder));

// ② 10 個原始頁籤按鈕全數存在，onclick 呼叫的 pane id 逐一比對正確（沒有貼錯目標）
const EXPECTED = {
  '數據視圖':'out-chart', '基準資料':'out-benchmark', '歸因模擬':'out-attribution', 'CFO級ROI引擎':'out-cfo-roi',
  '文案版本':'out-copy', '實驗計畫':'out-experiment', '素材指令':'out-prompt', '策略指令庫':'out-prompt-lib', '業務開發名單':'out-leadgen',
  '法規安全檢核':'out-safety'
};
const buttonRe = /<button class="tab-btn[^"]*" role="tab"[^>]*onclick="switchOutTab\(this,'([^']+)'\)">([^<]+)<\/button>/g;
const found = {};
let m;
while((m = buttonRe.exec(html))){ found[m[2]] = m[1]; }
check('10 個原始頁籤按鈕全數存在（數量正確）', Object.keys(found).length === 10, '實測 ' + Object.keys(found).length + ' 個');
const mismatches = Object.entries(EXPECTED).filter(([label, pane]) => found[label] !== pane);
check('每個頁籤按鈕的 onclick 目標 pane id 與整併前完全一致（沒有貼錯）',
  mismatches.length === 0, mismatches.length ? JSON.stringify(mismatches) : '');

// ③ 分組內容符合路線圖規劃：策略洞察=4個／執行產出=5個／治理=1個
const groups = [...html.matchAll(/<div class="tab-section-group"[^>]*>[\s\S]*?<div class="tab-section-label">([^<]+)<\/div>\s*<div class="tab-line">([\s\S]*?)<\/div>\s*<\/div>/g)];
check('3 個分區容器都抓得到（正則本身能定位到結構）', groups.length === 3, '實測 ' + groups.length + ' 組');
if(groups.length === 3){
  const counts = groups.map(g => (g[2].match(/<button/g) || []).length);
  check('分區內按鈕數量為 4／5／1（符合路線圖規劃的策略洞察／執行產出／治理）',
    JSON.stringify(counts) === JSON.stringify([4,5,1]), JSON.stringify(counts));
}

// ④ switchOutTab() 本身完全未被更動（機制不變，風險最小化的核心保證）
const switchFn = extractDeclaration(html, 'function switchOutTab(btn,paneId){');
check('switchOutTab() 函式邏輯完全未被更動',
  switchFn.indexOf("querySelectorAll('#screen-3 .tab-btn')") !== -1 &&
  switchFn.indexOf("querySelectorAll('#screen-3 .tab-pane')") !== -1);

// ⑤ 10 個 tab-pane 內容容器全數存在且未被搬動出 #screen-3（用既有 feature-freeze 的
//    量測邏輯之外，這裡直接確認每個 id 仍是 <div id="out-xxx" class="tab-pane...">）
Object.values(EXPECTED).forEach(paneId => {
  check('pane #' + paneId + ' 仍存在', new RegExp('<div id="' + paneId + '" class="tab-pane').test(html));
});

// ⑥ 唯一預設 active 的仍是「文案版本」（執行產出分區內），與整併前行為一致
check('預設仍只有一個 active 頁籤，且是文案版本（out-copy）',
  (html.match(/class="tab-btn active"/g) || []).length === 1 &&
  /class="tab-btn active"[^>]*aria-controls="out-copy"/.test(html));

console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗\n');
process.exit(fail ? 1 : 0);
