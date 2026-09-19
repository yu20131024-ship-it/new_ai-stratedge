/* 階段6：色碼收斂「乾跑（dry-run）規劃工具」——只產出審閱用報告，預設不修改任何檔案。
 *
 * 為什麼不直接做替換：把 4 種不同的紅（#DC2626/#FF0000/#8B1E1E/#A01818）收斂成同一個
 * --danger token，跟前面幾版做過的「字面值換成同值變數」不同——這 4 個顏色本來就不相等，
 * 收斂之後畫面上的顏色會真的改變（變淡／變深），不是純粹的程式碼重構。
 * 本專案鐵律第 9、11 條記載的三次事故都是「靜態比對全部過關，只有真實瀏覽器截圖才抓到錯」，
 * 而這次要做的正是會改變畫面顏色的操作，在無瀏覽器環境下不應該盲目套用。
 *
 * 因此本工具只做到「產出精確、可審閱的異動清單」為止：每一處要被替換的位置，
 * 連同所在的 CSS 選擇器／屬性上下文一併列出，供有瀏覽器的人審閱後，
 * 再用 --apply 執行真正的替換＋立刻截圖比對。
 *
 * 範圍界定（避免誤傷）：
 *   ① 只掃描「真實存在的 <style>...</style>」標籤內容（用與 verify-tag-boundaries-nodeps.js
 *      相同的循序掃描邏輯，逐一找配對的結束標籤，不會像天真的正則表達式那樣在巢狀／
   *    字面文字包含 "</style" 時誤判邊界——這正是階段2執行時在版本歷史註解裡踩過的雷）。
 *   ② 明確排除「報告匯出範本」——downloadPackage() 內組出獨立 HTML 報告的那段樣板字串，
 *      是完全獨立的另一份文件、有自己的一套配色系統，不屬於主畫面 :root token 的管轄範圍，
 *      絕不能被這次收斂誤觸。
 *   ③ 跳過「token 定義本身」（`--danger: #DC2626;` 這種行）——那是顏色的定義來源，不是要
 *      被替換的「使用處」。
 *   ④ 只處理 <style> 標籤內的文字。inline style="" 屬性與 JS 內的顏色字串（例如圖表色票陣列）
 *      不在本工具範圍內，因為那些情境下 var(--token) 能否直接替換字面值需要逐一判斷語境
 *      （例如傳給 Chart.js 的顏色陣列，可能需要 getComputedStyle 取值而非直接塞字串），
 *      風險與本工具「單純文字替換」的性質不同，留待下一輪個別處理。
 *
 * 用法：
 *   node _project-improvement/tools/plan-color-consolidation.js index.html            # 只印出報告
 *   node _project-improvement/tools/plan-color-consolidation.js index.html --json      # 機器可讀
 *   node _project-improvement/tools/plan-color-consolidation.js index.html --apply     # 實際套用（會先印出同一份報告）
 */
const fs = require('fs');
const path = require('path');

const file = process.argv[2] || 'index.html';
const asJson = process.argv.includes('--json');
const doApply = process.argv.includes('--apply');
const html = fs.readFileSync(file, 'utf8');

// ---------- 與 verify-tag-boundaries-nodeps.js 相同的循序、非重疊掃描邏輯 ----------
function scanTag(tag, src){
  const openRe = new RegExp('<' + tag + '(\\s[^>]*)?>', 'gi');
  const closeRe = new RegExp('</' + tag + '\\s*>', 'gi');
  const out = []; let m; let pos = 0;
  while(true){
    openRe.lastIndex = pos; m = openRe.exec(src); if(!m) break;
    const contentStart = openRe.lastIndex;
    closeRe.lastIndex = contentStart; const c = closeRe.exec(src);
    if(!c) break;
    out.push([contentStart, c.index]);
    pos = closeRe.lastIndex;
  }
  return out;
}

const styleSpans = scanTag('style', html);
const reportStart = html.indexOf('const html = `<!DOCTYPE html>');
const reportEnd = reportStart === -1 ? -1 : html.indexOf('</body></html>`);', reportStart) + '</body></html>`);'.length;
const liveSpans = styleSpans.filter(([a, b]) => reportStart === -1 || !(a >= reportStart && b <= reportEnd));

// ---------- 本次要收斂的映射表（路線圖原文點名的 4 種危險色範例）----------
const MAPPING = [
  { from: '#DC2626', to: '--danger', note: '已是 --danger 現行值，無需視覺確認，可視為單純去重複' },
  { from: '#FF0000', to: '--danger', note: '純紅，明顯偏亮，收斂後會變暗，需視覺確認' },
  { from: '#8B1E1E', to: '--danger', note: '暗紅，收斂後會變亮，需視覺確認' },
  { from: '#A01818', to: '--danger', note: '暗紅，收斂後會變亮，需視覺確認' }
];
const rootDanger = (html.match(/--danger:\s*(#[0-9a-fA-F]{3,8})/) || [])[1];

function lineNumberAt(pos){ return html.slice(0, pos).split('\n').length; }
function lineContentAt(pos){
  const start = html.lastIndexOf('\n', pos) + 1;
  let end = html.indexOf('\n', pos);
  if(end === -1) end = html.length;
  return html.slice(start, end).trim();
}
function isTokenDefLine(lineText){ return /^--[\w-]+\s*:\s*#[0-9a-fA-F]{3,8}\b/.test(lineText); }

const plan = [];
for(const { from, to, note } of MAPPING){
  const re = new RegExp(from.replace('#', '\\#'), 'gi');
  let m;
  while((m = re.exec(html))){
    const pos = m.index;
    const inLiveStyle = liveSpans.some(([a, b]) => pos >= a && pos < b);
    if(!inLiveStyle) continue;
    const lineText = lineContentAt(pos);
    if(isTokenDefLine(lineText)) continue; // 跳過 token 定義本身
    plan.push({ from, to, note, index: pos, line: lineNumberAt(pos), context: lineText.slice(0, 140) });
  }
}

if(asJson){
  console.log(JSON.stringify({ rootDangerValue: rootDanger, count: plan.length, changes: plan }, null, 2));
}else{
  console.log('\n=== 階段6：危險色收斂 —— 乾跑規劃報告（未修改任何檔案）===\n');
  console.log('--danger 現行值：' + rootDanger + '\n');
  console.log('範圍：僅限主畫面自身的 <style> 內容，已排除報告匯出範本；共找到 ' + plan.length + ' 處待替換。\n');
  const byFrom = {};
  plan.forEach(p => { (byFrom[p.from] = byFrom[p.from] || []).push(p); });
  for(const [from, items] of Object.entries(byFrom)){
    console.log(from + ' → var(--danger)　共 ' + items.length + ' 處　' + (MAPPING.find(m=>m.from===from).note));
    items.slice(0, 6).forEach(it => console.log('  行 ' + it.line + '：' + it.context));
    if(items.length > 6) console.log('  ……以及其餘 ' + (items.length - 6) + ' 處');
    console.log('');
  }
  console.log('提醒：本工具預設只產出報告。實際套用請在有瀏覽器的環境執行 --apply，');
  console.log('      並在套用前後各跑一次 visual-regression-check.py 做真實截圖比對（鐵律第9、11條）。\n');
}

if(doApply){
  let out = html;
  let applied = 0;
  // 由後往前替換，避免字串長度變動影響尚未處理位置的 index
  const sorted = plan.slice().sort((a, b) => b.index - a.index);
  for(const p of sorted){
    const before = out.slice(0, p.index);
    const after = out.slice(p.index + p.from.length);
    out = before + 'var(' + p.to + ')' + after;
    applied++;
  }
  const outPath = file.replace(/\.html$/, '') + '.color-consolidated.html';
  fs.writeFileSync(outPath, out);
  console.log('已套用 ' + applied + ' 處替換，輸出至：' + outPath);
  console.log('★ 原始檔案未被覆蓋。請自行比對、視覺驗證後再決定是否取代原檔。');
}
