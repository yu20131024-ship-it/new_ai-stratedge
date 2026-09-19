/* 階段7 驗證：27 個 DOMContentLoaded 整併為單一初始化佇列（SEInit）
 *
 * 測試方式（遵守鐵律第8條）：直接從 index.html 擷取「專案裡真正的」SEInit IIFE 原始碼，
 * 在 Node 中以最小 document/window 替身驅動它，不另外重寫一份簡化邏輯。
 *
 * 重點驗證的是「這次改動最容易出錯的三件事」：
 *   ① 執行順序等價：原本掛在 document 上的監聽器一定早於掛在 window 上的（at-target 早於 bubble），
 *      佇列必須用 phase 0／1 完整重現，否則初始化順序會被悄悄改掉。
 *   ② 錯誤隔離：單一步驟丟例外時，後面的步驟仍必須全部執行（舊架構做不到這件事）。
 *   ③ 遲到註冊：DOMContentLoaded 之後才註冊的步驟必須立即執行，不可被靜默吞掉。
 *
 * 用法：node _project-improvement/tests/stage7-init-queue.test.js
 */
const { readIndex, extractDeclaration } = require('./lib/extract.js');
const html = readIndex();

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ✅ ' + name + (detail ? '　' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '　' + detail : '')); }
}

// ---- 以最小替身載入真正的 SEInit 原始碼 ----
function loadSEInit(){
  // extractDeclaration 以大括號配對取到 IIFE 函式本體結尾，補回 ')();' 才是完整的立即執行運算式
  const src = extractDeclaration(html, 'window.SEInit = (function(){') + ')();';
  const listeners = {};
  const fakeDocument = {
    readyState: 'loading',
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); }
  };
  const fakeWindow = { performance: { now: () => 0 } };
  const errs = [];
  const fakeConsole = { error: (...a) => errs.push(a.join(' ')), warn: () => {}, log: () => {} };
  const run = new Function('window', 'document', 'console',
    src.replace(/^window\.SEInit = /, 'const SEInit = ') + '\nreturn SEInit;');
  const SEInit = run(fakeWindow, fakeDocument, fakeConsole);
  return { SEInit, fire: () => (listeners['DOMContentLoaded'] || []).forEach(f => f()), consoleErrors: errs, listeners };
}

console.log('\n=== 階段7：單一初始化佇列（SEInit）驗證 ===\n');

// ① 執行順序等價（phase 0 全部跑完才跑 phase 1）
{
  const { SEInit, fire } = loadSEInit();
  const order = [];
  SEInit.register(() => order.push('doc-1'), 'doc-1', 0);
  SEInit.register(() => order.push('win-1'), 'win-1', 1);   // 註冊得早，但原本是 window 監聽器 → 必須後跑
  SEInit.register(() => order.push('doc-2'), 'doc-2', 0);
  SEInit.register(() => order.push('win-2'), 'win-2', 1);
  check('尚未觸發前不會提前執行任何步驟', order.length === 0 && SEInit.pending === 4);
  fire();
  check('phase 0（原 document 監聽器）全部早於 phase 1（原 window 監聽器）',
    order.join(',') === 'doc-1,doc-2,win-1,win-2', '實際順序：' + order.join(' → '));
}

// ② 錯誤隔離
{
  const { SEInit, fire, consoleErrors } = loadSEInit();
  const order = [];
  SEInit.register(() => order.push('a'), 'a', 0);
  SEInit.register(() => { throw new Error('刻意失敗'); }, 'boom', 0);
  SEInit.register(() => order.push('c'), 'c', 0);
  SEInit.register(() => order.push('d'), 'd', 1);
  fire();
  check('單一步驟丟例外不會中斷後續步驟', order.join(',') === 'a,c,d', '實際執行：' + order.join(' → '));
  check('失敗步驟被記錄到 SEInit.errors 並指名道姓',
    SEInit.errors.length === 1 && SEInit.errors[0].name === 'boom' && /刻意失敗/.test(SEInit.errors[0].message));
  check('失敗步驟同時寫進 console.error 供現場排查', consoleErrors.some(s => /boom/.test(s)));
  check('執行紀錄 SEInit.log 完整涵蓋 4 個步驟（含失敗那個）', SEInit.log.length === 4 && SEInit.log.filter(x => !x.ok).length === 1);
}

// ③ 遲到註冊
{
  const { SEInit, fire } = loadSEInit();
  fire();
  let ran = false;
  SEInit.register(() => { ran = true; }, 'late', 0);
  check('DOMContentLoaded 之後才註冊的步驟會立即執行（不被靜默吞掉）', ran === true && SEInit.fired === true);
}

// ④ 防呆：重複觸發不得讓步驟跑兩次
{
  const { SEInit, fire } = loadSEInit();
  let n = 0;
  SEInit.register(() => { n++; }, 'once', 0);
  fire(); fire();
  check('事件重複派送時步驟不會被執行兩次（無雙重綁定）', n === 1, '執行次數：' + n);
}

// ⑤ 靜態檢查：全檔不得再有漏網的 DOMContentLoaded 監聽器
{
  const stray = [];
  const re = /(document|window)\.addEventListener\('DOMContentLoaded'\s*,\s*([^)]*)\)/g;
  let m;
  while((m = re.exec(html))){
    if(m[2].trim() !== 'runAll') stray.push(m[0].slice(0, 70));   // runAll 是 SEInit 自己唯一的那一個
  }
  check('全檔只剩 SEInit 內部唯一一個 DOMContentLoaded 監聽器', stray.length === 0,
    stray.length ? '仍有：' + stray.join(' / ') : '');
  const registrations = (html.match(/\bregisterInit(?:Late)?\s*\(/g) || []).length;
  check('27 個原始初始化區塊全數改走佇列（registerInit 呼叫數 ≥ 27）', registrations >= 27, '實測 ' + registrations + ' 次');
}

console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗\n');
process.exit(fail ? 1 : 0);
