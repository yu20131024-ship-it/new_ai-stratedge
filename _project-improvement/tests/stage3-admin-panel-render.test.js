// _project-improvement/tests/stage3-admin-panel-render.test.js
//
// 階段3自動化測試：驗證「移除重複的 esc21()，改呼叫真正的 esc()」這個改動
// 沒有破壞管理後台的渲染邏輯，且最重要的 XSS 轉義行為完全沒有改變。
//
// 用法：node _project-improvement/tests/stage3-admin-panel-render.test.js
// 需要 jsdom（已列在 package.json 的 devDependencies，執行前請先
// `npm install` 一次；只是開發/測試用，不影響 Netlify 正式部署——
// Netlify functions 只會安裝 package.json 的 dependencies，不會安裝
// devDependencies，也不會用到 index.html 本身）。
//
// 做法：直接從 index.html 抽取「真正的」esc() 定義與
// openAdminPanel()～renderAdminLogs() 這一整段原始碼，用 Node 內建的 vm
// 模組在一個用 jsdom 模擬出來的最小瀏覽器環境裡執行——不是另外重寫一份邏輯，
// 而是真的跑這份會被部署上線的程式碼本身。

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const indexPath = path.join(__dirname, '..', '..', 'index.html');
const html = fs.readFileSync(indexPath, 'utf-8');

const escSource = "function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));}";
assert.ok(html.includes(escSource), '找不到 esc() 完整定義（原始碼字面文字可能已變動，測試需要一併更新）');

const startMarker = 'function openAdminPanel(){';
const endMarker = "+ `<style>.admin-user-detail.open{display:block!important}</style>`;\n}";
const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker, startIdx) + endMarker.length;
assert.ok(startIdx > 0 && endIdx > startIdx, '找不到 openAdminPanel~renderAdminLogs 區塊，原始碼結構可能已變動');
const adminPanelSource = html.slice(startIdx, endIdx);

// v2.3.27 起這段程式碼不應該再出現 esc21——它是 v2.3.24 就存在、跟真正的
// esc() 逐字元一模一樣的重複函式，只是被另外取了個名字，並非真的有不同用途。
assert.ok(!adminPanelSource.includes('esc21'), '不應該再出現 esc21（如果這個assert失敗，代表esc21又被加回來了）');
assert.ok(adminPanelSource.includes('esc('), '應該要呼叫共用的 esc()');

function freshSandbox() {
  const dom = new JSDOM('<div id="admin-panel-modal" style="display:none"></div><div id="admin-panel-body"></div>');
  const sandbox = {
    document: dom.window.document,
    window: dom.window,
    console,
    adminDownloadFile: () => {},
    adminDeleteFile: () => {}
  };
  vm.createContext(sandbox);
  vm.runInContext(escSource + '\n' + adminPanelSource, sandbox);
  return sandbox;
}

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('✅ PASS -', name);
    passed++;
  } catch (e) {
    console.log('❌ FAIL -', name);
    console.log('   ', e.message);
    failed++;
  }
}

test('混合資料（未登入下載／已登入使用者／已刪除檔案）渲染正常，且 XSS 轉義正確運作', () => {
  const sandbox = freshSandbox();
  // 姓名與刪除者欄位故意帶入 <script>／<img onerror> 這類典型 XSS 測試字串，
  // 驗證真的有經過 esc() 轉義，不會被瀏覽器當成可執行的標籤解析。
  const events = [
    { type: 'download', email: 'admin@example.com', name: '<script>alert(1)</script>王小明', time: '2026-01-02T00:00:00Z', fileId: 'f1', reportName: 'report"1"', reportFormat: 'html' },
    { type: 'login', email: 'admin@example.com', name: '<script>alert(1)</script>王小明', time: '2026-01-01T00:00:00Z' },
    { type: 'download', email: 'admin@example.com', name: '<script>alert(1)</script>王小明', time: '2026-01-03T00:00:00Z', fileDeleted: true, fileDeletedAt: '2026-01-04T00:00:00Z', fileDeletedBy: '<img src=x onerror=alert(2)>管理者' },
    { type: 'download', isAnonymous: true, ip: '1.2.3.4', userAgent: 'TestAgent/1.0', time: '2026-01-05T00:00:00Z', fileId: 'f2', reportName: '匿名報告', reportFormat: 'pdf' }
  ];
  sandbox.renderAdminLogs(events);
  const bodyHtml = sandbox.document.getElementById('admin-panel-body').innerHTML;

  assert.ok(bodyHtml.includes('未登入下載'), '應該要顯示未登入下載區塊');
  assert.ok(!bodyHtml.includes('<script>alert(1)</script>'), '姓名裡的 <script> 標籤必須被轉義，不可原樣出現');
  assert.ok(bodyHtml.includes('&lt;script&gt;'), '轉義後應該看得到 &lt;script&gt;');
  assert.ok(!bodyHtml.includes('<img src=x onerror=alert(2)>'), '刪除者欄位也必須正確轉義');
  assert.ok(bodyHtml.includes('&lt;img src=x onerror=alert(2)&gt;'), '刪除者名稱轉義後應該可見');
  assert.ok(bodyHtml.includes('匿名報告'), '匿名下載的檔名應該正常顯示');
  assert.ok(bodyHtml.includes('report&quot;1&quot;') || bodyHtml.includes('report"1"'), '檔名裡的雙引號應被安全處理');
});

test('完全沒有資料時顯示正確提示文字', () => {
  const sandbox = freshSandbox();
  sandbox.renderAdminLogs([]);
  const emptyHtml = sandbox.document.getElementById('admin-panel-body').innerHTML;
  assert.ok(emptyHtml.includes('目前尚無任何登入或下載紀錄'));
});

test('全部都是匿名下載時仍正確顯示未登入下載區塊', () => {
  const sandbox = freshSandbox();
  sandbox.renderAdminLogs([
    { type: 'download', isAnonymous: true, ip: '9.9.9.9', userAgent: 'X', time: '2026-01-01T00:00:00Z', reportName: 'r' }
  ]);
  const allAnonHtml = sandbox.document.getElementById('admin-panel-body').innerHTML;
  assert.ok(allAnonHtml.includes('未登入下載'));
});

console.log('');
console.log(`共 ${passed + failed} 項測試，通過 ${passed} 項，失敗 ${failed} 項`);
process.exitCode = failed > 0 ? 1 : 0;
