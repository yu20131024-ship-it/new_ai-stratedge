/* 一鍵執行本專案所有可自動化的驗證。
 * 用法：node _project-improvement/tests/run-all.js
 * 設計原則：零外部依賴（本專案的驗證環境可能無網路、無 node_modules）。
 */
const cp = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const STEPS = [
  ['inline JS 語法檢查',        ['_project-improvement/tools/check-inline-js-syntax.js', 'index.html']],
  ['style/script 標籤邊界檢查', ['_project-improvement/tools/verify-tag-boundaries-nodeps.js', 'index.html']],
  ['階段1：功能凍結護欄',        ['_project-improvement/tests/feature-freeze.test.js']],
  ['階段2：Prompt 動態組裝',     ['_project-improvement/tests/stage2-prompt-size.test.js']],
  ['階段2：分段生成與暫存',      ['_project-improvement/tests/stage2-segmented-analysis.test.js']],
  ['階段2：429 退避策略',        ['_project-improvement/tests/stage2-rate-limit-backoff.test.js']],
  ['階段3：可重現模擬與來源標示', ['_project-improvement/tests/stage3-deterministic-simulation.test.js']],
  ['階段7：單一初始化佇列',      ['_project-improvement/tests/stage7-init-queue.test.js']],
  ['階段8：報告合併輸出管線',    ['_project-improvement/tests/stage8-report-pipeline.test.js']],
  ['階段6：色碼值保留替換',      ['_project-improvement/tests/stage6-color-consolidation.test.js']],
  ['v2.3.42：Agnes 合規配額守門', ['_project-improvement/tests/stage-v2342-quota-guard.test.js']],
  ['Agnes 路由與 RPM 節流',      ['_project-improvement/tests/stage-agnes-rpm-and-routing.test.js']],
  ['階段7：緊鄰補丁合併',        ['_project-improvement/tests/stage7-patch-merge.test.js']],
  ['階段4：頁籤整併為3分區',      ['_project-improvement/tests/stage4-tab-sections.test.js']],
  ['階段5：locked步驟可點+提示', ['_project-improvement/tests/stage5-locked-nav-ux.test.js']],
  ['歸因模擬圖表高度修正',        ['_project-improvement/tests/stage-attrib-chart-box-height.test.js']]
];

let failed = 0;
for(const [name, args] of STEPS){
  console.log('\n────────────────────────────────────────');
  console.log('▶ ' + name);
  const r = cp.spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  if(r.stderr) process.stderr.write(r.stderr);
  if(r.status !== 0){ failed++; console.log('✗ ' + name + ' 失敗'); }
}
console.log('\n════════════════════════════════════════');
console.log(failed === 0 ? '全部通過 ✅' : (failed + ' 項失敗 ❌'));
process.exit(failed ? 1 : 0);
