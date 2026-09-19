/* 階段7 驗證：緊鄰補丁合併（style id / script id → 更少的標籤）
 *
 * 這支測試驗證的不是「執行期行為」，而是「合併過程本身有沒有偷改內容」——
 * 這正是這次實作過程中最容易犯錯、也真的犯了三次錯的地方：
 *   ① 第一版：naive 掃描器誤判「落在 <script> 字串內的字面 <style> 文字」為真標籤
 *      （downloadPackage() 的報告範本、admin 面板動態插入的 <style> 字串）
 *   ② 第二版修正後仍誤判「落在 HTML 註解 <!-- --> 裡的字面 <style> 文字」
 *      （v2.3.29 版本歷史註解裡寫的「合併成11個`<style>`區塊」說明文字）
 *   ③ 第三版修正後，天真地把「帶有 src/onerror 等其他屬性的外部腳本標籤」
 *      （Chart.js 的 <script defer src=... onerror=...>）誤當成可合併的補丁，
 *      合併時用 <script id="merged-...."> 蓋掉了它原本的 src/onerror 屬性，
 *      導致 CDN 載入失敗時的降級機制被悄悄弄丟。
 * 三次錯誤都不是「執行時才會爆」的那種，而是「靜態比對表面上會過關」的那種，
 * 這正是本專案鐵律第9、11條反覆點名的同一類風險。這支測試把三個教訓都寫成斷言，
 * 確保未來任何人重新執行合併工具，同一個坑不會再摔一次。
 *
 * 用法：node _project-improvement/tests/stage7-patch-merge.test.js
 */
const { readIndex } = require('./lib/extract.js');
const html = readIndex();

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ✅ ' + name + (detail ? '　' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '　' + detail : '')); }
}

console.log('\n=== 階段7：緊鄰補丁合併 驗證 ===\n');

// ① 標籤數量確實減少（碎片化程度降低）——用專案既有、已驗證過comment/script-string-aware
//    的邊界工具取得精確數字，不用天真的正則（那正是這次踩過三次坑的同一類問題）。
const { execSync } = require('child_process');
const boundaryOut = execSync('node ' + __dirname + '/../tools/verify-tag-boundaries-nodeps.js ' + __dirname + '/../../index.html').toString();
const styleCount = Number((boundaryOut.match(/<style>：(\d+) 個/) || [])[1]);
const scriptCount = Number((boundaryOut.match(/<script>：(\d+) 個/) || [])[1]);
// ★ 注意：v2.3.30 路線圖原文與本專案早期文件記載的「80個 <style> 標籤」，
//   其量測方式（naive 正則掃描）誤把 downloadPackage() 報告匯出範本裡內嵌的
//   literal <style>...</style>（那是獨立文件的一部分，不是本文件的真實標籤）也算了
//   進去。用本專案現在這支 comment/script-string-aware 的正確工具重新量測 v2.3.30
//   原始檔案，真正的 style 標籤數其實是 57 個（script 不受影響，仍是 37 個，
//   因為 script 區域偵測本來就不需要排除巢狀 style，樣本量測一致）。
//   以下斷言以「重新量測過的正確基準」為準。
check('<style> 標籤數量相較 v2.3.30 真實基準（57個，見上方說明）明顯減少', styleCount < 57 && styleCount >= 15,
  '實測 ' + styleCount + ' 個');
check('<script> 標籤數量相較 v2.3.30 基準（37個）明顯減少', scriptCount < 37 && scriptCount >= 20,
  '實測 ' + scriptCount + ' 個');

// ② 合併後的區塊確實存在，且帶有可追溯的原始 id 清單註解
check('合併後的 style 區塊存在且保留原始 id 追溯清單', /<style id="merged-style-run-\d+">/.test(html) && /v2\.3\.38 階段7合併：原始 id 依序為/.test(html));
check('合併後的 script 區塊存在且保留原始 id 追溯清單', /<script id="merged-script-run-\d+">/.test(html) && /v2\.3\.38 階段7合併：原始 id 依序為/.test(html));

// ③ 教訓①②：報告範本與 admin 動態樣式字串裡的字面 <style> 文字，不可被誤判為真標籤而合併掉
check('downloadPackage() 報告範本區段仍完整（未被誤判合併）',
  html.indexOf('const html = `<!DOCTYPE html>') !== -1 && html.indexOf('</body></html>`);') !== -1);
check('admin 面板動態插入樣式的字面字串仍完整未被破壞',
  html.indexOf("`<style>.admin-user-detail.open{display:block!important}</style>`") !== -1);

// ④ 教訓③：外部腳本標籤的 src／onerror 屬性必須原封不動保留，不可被合併掉
check('Chart.js 外部腳本標籤的 src 屬性仍完整',
  /<script defer src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/Chart\.js\/4\.4\.1\/chart\.umd\.min\.js"/.test(html));
check('Chart.js 載入失敗的 onerror 降級機制仍完整',
  /onerror="window\._chartLoadFailed=true"/.test(html));

// ⑤ 靜態語法與標籤邊界（run-all.js 也會跑，這裡再次確認與本次改動直接相關）
check('全檔 <style>/<script> 標籤邊界不得有任何異常',
  boundaryOut.indexOf('邊界異常 0') !== -1 && (boundaryOut.match(/邊界異常 0/g) || []).length === 2);

console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗\n');
process.exit(fail ? 1 : 0);
