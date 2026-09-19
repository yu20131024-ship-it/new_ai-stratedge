/* 使用者回報：歸因模擬頁籤裡的長條圖下方留了一大片空白。
 *
 * 根因：歸因模擬用的是純 SVG、依管道數量而定的矮圖表，卻跟主要分析頁的 Chart.js
 * canvas 大圖表共用同一個 .chart-box class 名稱；main.css 裡有一條規則把所有
 * .chart-box 都強制設成 34rem（約544px）高（專門給 canvas 大圖表用），歸因模擬的
 * 小圖表因此被硬撐開，圖表下方出現大片空白。
 *
 * 修法：歸因模擬的圖表容器多加一個 attrib-svg-chart-box class，並用更高優先權的
 * 組合選擇器（.chart-box.attrib-svg-chart-box）把高度改回依內容自動撐高，
 * 不影響其他仍在用 .chart-box 的 Chart.js 大圖表。
 *
 * 用法：node _project-improvement/tests/stage-attrib-chart-box-height.test.js
 */
const { readIndex } = require('./lib/extract.js');
const html = readIndex();

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ✅ ' + name + (detail ? '　' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '　' + detail : '')); }
}

console.log('\n=== 歸因模擬圖表高度修正 驗證 ===\n');

check('歸因模擬的圖表容器已加上區分用的 class（attrib-svg-chart-box）',
  /<div class="chart-box attrib-svg-chart-box"/.test(html));

check('新增的覆蓋規則存在，且優先權足以蓋過通用 .chart-box{height:34rem} 規則',
  /\.chart-box\.attrib-svg-chart-box\{height:auto!important;min-height:0!important/.test(html));

// 確認覆蓋規則排在通用規則之後（雖然此處靠 specificity 而非source order取勝，
// 但排在後面仍是較清楚的寫法，避免未來有人誤以為順序有影響時搞混）
const idxGeneric = html.indexOf('.chart-box{height:34rem!important');
const idxOverride = html.indexOf('.chart-box.attrib-svg-chart-box{height:auto!important');
check('覆蓋規則的選擇器包含兩個 class，specificity 高於任何單一 .chart-box 規則（含 media query 內的那條）',
  idxGeneric !== -1 && idxOverride !== -1 && idxOverride > idxGeneric);

// 其他 3 處 Chart.js canvas 大圖表的 .chart-box 保持原樣，沒有被誤動
check('主要分析頁的 3 個 Chart.js canvas 圖表容器（chart-budget/chart-funnel/chart-scenario）未被更動',
  html.indexOf('<div class="chart-box"><canvas id="chart-budget">') !== -1 &&
  html.indexOf('<div class="chart-box"><canvas id="chart-funnel">') !== -1 &&
  html.indexOf('<div class="chart-box"><canvas id="chart-scenario">') !== -1);

console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗\n');
process.exit(fail ? 1 : 0);
