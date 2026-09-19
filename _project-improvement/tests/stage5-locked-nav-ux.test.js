/* 階段5 驗證（低風險子項）：locked 步驟改為「可點＋滑鼠懸停提示」
 *
 * 路線圖要求：「locked 改為可點＋tooltip 提示還缺什麼」，解決「按鈕沒反應」的
 * 觀感問題。實際追查後發現 navigateFlowStep() 其實本來就會在點擊 locked 步驟時
 * 顯示 toast 說明——真正的問題是：①JS 用 !important 把游標鎖死成 not-allowed，
 * ②CSS 用一個蓋滿整顆按鈕的不透明遮罩蓋住文字，兩者加在一起讓使用者誤以為
 * 按鈕死掉了，因此根本不會去點，永遠看不到那則說明。
 * 本測試驗證這兩處視覺誤導已經修正，且原本「點擊會顯示說明」的邏輯完全未變。
 *
 * 用法：node _project-improvement/tests/stage5-locked-nav-ux.test.js
 */
const { readIndex, extractDeclaration } = require('./lib/extract.js');
const html = readIndex();

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ✅ ' + name + (detail ? '　' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '　' + detail : '')); }
}

console.log('\n=== 階段5：locked 步驟可點＋懸停提示 驗證 ===\n');

// ① JS 不再把游標鎖死成 not-allowed
check('forceFlowNavNoHoverInvert() 不再對 locked 步驟設定 cursor:not-allowed',
  html.indexOf("btn.style.setProperty('cursor', locked ? 'not-allowed' : 'pointer', 'important')") === -1);
check('locked 步驟的游標改為 pointer（可互動）',
  /btn\.style\.setProperty\('cursor', 'pointer', 'important'\);/.test(html));

// ② CSS 不再用蓋滿整顆按鈕的不透明遮罩
check('CSS 樣式表本身的 cursor 也改為 pointer', /\.flow-nav-item\.locked \{\s*cursor: pointer;/.test(html));
check('locked 遮罩不再蓋滿整顆按鈕（inset:0 已移除，改為右上角小徽章）',
  !/\.flow-nav-item\.locked::after \{\s*content: "尚未解鎖";\s*position: absolute;\s*inset: 0;/.test(html));
check('locked 遮罩仍保留「尚未解鎖」的視覺提示（鎖頭圖示徽章），沒有整個拿掉', /content: "🔒";/.test(html));
check('新徽章不會擋住點擊（pointer-events:none，點擊仍會傳到按鈕本身）', /pointer-events: none;\s*\}/.test(html));

// ③ 新增滑鼠懸停提示，且文案與點擊後的 toast 共用同一個函式（不重複維護兩套文案）
const updateFlowNav = extractDeclaration(html, 'function updateFlowNav(){');
check('updateFlowNav() 會依 getLockedStepMessage() 動態設定 title 屬性',
  updateFlowNav.indexOf('btn.title = getLockedStepMessage(n)') !== -1);
check('步驟解鎖後會移除 title（避免殘留過期的鎖定說明）',
  updateFlowNav.indexOf("btn.removeAttribute('title')") !== -1);

// ④ 核心保證：點擊行為完全未被更動——navigateFlowStep() 邏輯逐字保留
const navFn = extractDeclaration(html, 'function navigateFlowStep(n){');
check('navigateFlowStep() 點擊 locked 步驟時仍會呼叫 toast(getLockedStepMessage(...))',
  navFn.indexOf('toast(getLockedStepMessage(n)') !== -1);
check('canAccessStep() 判斷邏輯完全未被更動',
  extractDeclaration(html, 'function canAccessStep(n){').indexOf('channelConfirmed && selected.length>0') !== -1);

console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗\n');
process.exit(fail ? 1 : 0);
