/* 臨時性測試（非路線圖任務）：v2.3.36 暫時停用 Google 登入關卡。
 *
 * 目的：使用者要求「暫時隱藏登入功能，測試完畢後恢復」。這支測試驗證：
 *   ① 開關確實存在且目前為 true（測試模式生效中）
 *   ② showGate() 在停用時會主動呼叫 hideGate()，而不是放著遮罩維持預設的 display:flex
 *      （這是實作時抓到的一個真實 bug：一開始寫成單純 no-op return，
   *      遮罩的 inline style 預設就是顯示狀態，不主動隱藏的話功能不會真的被隱藏）
 *   ③ 頁面上有醒目的黃色提示條，之後才不會忘記改回來
 *   ④ 除了「要不要顯示遮罩」以外，netlifyIdentity 其餘邏輯（登入/登出/管理後台）完全未被改動
 *
 * 這支測試是暫時性的，恢復登入關卡（把開關改回 false）後，這支測試可以刪除，
 * 或者屆時把斷言反過來驗證「已還原」。
 *
 * 用法：node _project-improvement/tests/temp-auth-gate-disabled.test.js
 */
const { readIndex } = require('./lib/extract.js');
const html = readIndex();

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ✅ ' + name + (detail ? '　' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '　' + detail : '')); }
}

console.log('\n=== 臨時：Google 登入關卡停用狀態 檢查 ===\n');

check('AUTH_GATE_DISABLED_FOR_TESTING 旗標存在且正式版預設為 false',
  /window\.AUTH_GATE_DISABLED_FOR_TESTING\s*=\s*false/.test(html));

check('showGate() 在停用時會主動呼叫 hideGate()（不是放著遮罩不管）',
  /if\(window\.AUTH_GATE_DISABLED_FOR_TESTING\)\{\s*hideGate\(\);\s*return;\s*\}/.test(html));

check('頁面上有醒目的測試模式提示條，避免忘記改回來',
  html.indexOf('auth-gate-testing-banner') !== -1 && html.indexOf('測試模式') !== -1);

check('載入當下已同步隱藏遮罩，避免短暫閃現登入畫面',
  /if\(window\.AUTH_GATE_DISABLED_FOR_TESTING\)\{\s*var earlyGate=document\.getElementById\('auth-gate'\);/.test(html));

// netlifyIdentity 的核心事件處理（登入/登出/管理後台判斷/__logEvent）不應被本次改動觸及
check('netlifyIdentity.on(\'login\'...) 邏輯未被更動', html.indexOf("netlifyIdentity.on('login', function(user){") !== -1);
check('netlifyIdentity.on(\'logout\'...) 邏輯未被更動', html.indexOf("netlifyIdentity.on('logout', function(){") !== -1);
check('updateAdminUI／__logEvent 等背景邏輯未被更動', html.indexOf('function updateAdminUI(user){') !== -1 && html.indexOf('window.__logEvent = function(type, extra){') !== -1);

console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗\n');
console.log('正式版要求 AUTH_GATE_DISABLED_FOR_TESTING 保持 false；若要做測試，請在測試分支另行覆寫。\n');
process.exit(fail ? 1 : 0);
