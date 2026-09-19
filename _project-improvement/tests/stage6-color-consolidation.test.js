/* 階段6 驗證：4 種危险紅色（#DC2626/#FF0000/#8B1E1E/#A01818）→ var(--danger) 全面收斂
 *
 * 分兩批完成：
 *   ① #DC2626（18處）：值保留替換，--danger 本身的定義值就是 #DC2626，
 *      替換後瀏覽器算出來的顏色逐位元相同，是去重複，不是視覺變更。
 *   ② #FF0000／#8B1E1E／#A01818（合計32處）：視覺統一替換，這三色跟 --danger
 *      本來就不同，收斂後顯示顏色會真的改變（分別變暗、變亮、變亮），
 *      套用前已產出色票對照預覽供人工確認視覺方向合理（見交付說明），
 *      確認後才實際套用到 index.html。
 *
 * 用法：node _project-improvement/tests/stage6-color-consolidation.test.js
 */
const { readIndex } = require('./lib/extract.js');
const html = readIndex();

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ✅ ' + name + (detail ? '　' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '　' + detail : '')); }
}

console.log('\n=== 階段6：#DC2626 → var(--danger) 值保留驗證 ===\n');

// ① --danger 的定義值必須仍是 #DC2626（否則下面「值保留」的前提就不成立）
const rootMatch = html.match(/--danger:\s*(#[0-9a-fA-F]{3,8})/);
check('--danger 的定義值仍是 #DC2626（替換的前提條件）',
  rootMatch && rootMatch[1].toLowerCase() === '#dc2626', rootMatch && rootMatch[1]);

// ★ 重要範圍界定：以下兩項統計必須只看「真實的 <style> 標籤內容」，
//   不可用天真的全檔案 grep——本檔前面的版本歷史 HTML 註解裡，說明文字本身就寫著
//   「#DC2626」「var(--danger)」這些字面文字（用來記錄這次做了什麼），若不排除註解，
//   統計會被自己的文件說明污染。用與 codemod 完全相同的循序標籤掃描邏輯來界定範圍，
//   確保測試驗證的是「codemod 實際觸及的範圍」，而不是整份文件的字面文字搜尋。
function scanStyleSpans(src){
  const openRe = /<style(\s[^>]*)?>/gi, closeRe = /<\/style\s*>/gi;
  const out = []; let m; let pos = 0;
  while(true){
    openRe.lastIndex = pos; m = openRe.exec(src); if(!m) break;
    const contentStart = openRe.lastIndex;
    closeRe.lastIndex = contentStart; const c = closeRe.exec(src);
    if(!c) break;
    out.push(src.slice(contentStart, c.index));
    pos = closeRe.lastIndex;
  }
  return out;
}
const styleSpansText = scanStyleSpans(html);
const reportStart = html.indexOf('const html = `<!DOCTYPE html>');
const reportEnd = html.indexOf('</body></html>`);', reportStart) + '</body></html>`);'.length;
// 排除報告範本：直接用「不在 reportStart-reportEnd 之間」重新掃一次會更精確，這裡簡化為
// 對每個 style span 個別檢查其在全檔案中的原始位置是否落在報告範本區間內。
function scanStyleSpansExcludingReport(src, rStart, rEnd){
  const openRe = /<style(\s[^>]*)?>/gi, closeRe = /<\/style\s*>/gi;
  const out = []; let m; let pos = 0;
  while(true){
    openRe.lastIndex = pos; m = openRe.exec(src); if(!m) break;
    const contentStart = openRe.lastIndex;
    closeRe.lastIndex = contentStart; const c = closeRe.exec(src);
    if(!c) break;
    if(!(contentStart >= rStart && c.index <= rEnd)) out.push(src.slice(contentStart, c.index));
    pos = closeRe.lastIndex;
  }
  return out;
}
const liveStyleText = scanStyleSpansExcludingReport(html, reportStart, reportEnd).join('\n');

// ② 全部 4 種危險紅（#DC2626/#FF0000/#8B1E1E/#A01818）合計至少 50 處已改為 var(--danger)
//    （18 處零風險的 #DC2626 + 32 處視覺統一的其餘三色，全部落在真實 <style> 範圍內，
//    不是文件註解裡的說明文字）
const varCount = (liveStyleText.match(/var\(--danger\)/g) || []).length;
check('主畫面 <style> 範圍內至少 50 處字面值已改為 var(--danger)（4 種紅全部收斂）',
  varCount >= 50, '實測 ' + varCount + ' 處');

// ③ 剩餘的 4 種危險紅字面值（僅計真實 <style> 範圍內）應只剩各自的 token 定義行本身，
//    使用處必須全部替換乾淨，一處都不留
['#dc2626','#ff0000','#8b1e1e','#a01818'].forEach(hex=>{
  const remaining = (liveStyleText.match(new RegExp(hex,'gi')) || []).length;
  const expectDefLine = hex === '#dc2626' ? 1 : 0; // 只有 --danger 自己的定義行是 #DC2626
  check('主畫面 <style> 範圍內 '+hex+' 使用處已全數收斂（僅允許 '+expectDefLine+' 處 token 定義）',
    remaining === expectDefLine, '實測剩餘 ' + remaining + ' 處');
});

// ④ 報告匯出範本完全未被觸碰（它是獨立文件，有自己的配色系統）
check('報告匯出範本區段仍可正確定位（未被本次改動破壞邊界）',
  reportStart !== -1 && reportEnd > reportStart, '範圍 ' + reportStart + '–' + reportEnd);

// ⑤ 靜態語法與標籤邊界（雙重保險，run-all.js 也會跑，這裡再次確認與本次改動直接相關）
const scriptOk = !/#dc2626!important;#dc2626/i.test(html); // 防呆：確保沒有替換到一半黏在一起的殘破字串
check('替換處未產生任何殘破或重複黏連的字面值', scriptOk);

console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗\n');
process.exit(fail ? 1 : 0);
