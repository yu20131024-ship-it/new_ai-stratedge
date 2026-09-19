/* 階段7：合併「真正緊鄰」的 <style id>/<script id> 補丁區塊（含精確驗證清單版）。
 *
 * 與第一版的差異：這一版在合併的同時，把每個 run「合併前的原始每段文字」逐字寫進
 * 一份 JSON 清單（manifest），讓驗證腳本可以做「逐字元精確比對」，
 * 不必用容易誤判的正則表達式去反推「合併後的文字扣掉我加的說明註解，是否等於合併前」——
 * 上一版就是在這一步栽了跟頭：трace 註解的正則表達式在某個 run 上意外沒有精準停在
 * 自己的結尾，導致驗證腳本誤判內容遺失。這次直接把「合併前的正確答案」存下來，
 * 不需要事後用正則反推，才是真正可靠的驗證方式。
 *
 * 用法：node merge-adjacent-patches.js index.html style manifest-style.json
 *       node merge-adjacent-patches.js index.html script manifest-script.json
 */
const fs = require('fs');
const file = process.argv[2];
const tag = process.argv[3];
const manifestPath = process.argv[4];
let html = fs.readFileSync(file, 'utf8');

// ★ 根本修正（比排除單一報告範本更通用）：HTML 對 <script>/<style> 這類「raw-text 元素」
//   的解析規則是——一旦進入該元素，瀏覽器只會找下一個字面上的 </script 或 </style
//   序列來結束它，完全不理會裡面的內容是不是「看起來像另一個標籤」。
//   這代表：一個真正的 <script>...</script> 區塊「內部」，就算裡面的 JS 字串字面值
//   剛好寫出 "<style>...</style>" 這幾個字元（本檔案至少有兩處這樣的情況：
//   一處是 downloadPackage() 組報告的樣板字串，另一處是 admin 面板動態插入樣式的
//   `<style>.admin-user-detail...</style>` 字串），瀏覽器並不會把它當成真正的 <style>
//   標籤——因為瀏覽器當下正在等待 </script，根本不會去檢查 <style。
//   反過來說，我自己寫的 naive 掃描器如果沒有先排除「落在 <script> 內部」的位置，
//   就會把這些字面文字誤判成真正的 <style> 標籤，導致位置全部算錯。
//   修法：先掃出所有真正的 <script>...</script> 區間（這一步天生正確，因為 </script
//   本身就是瀏覽器唯一認得的終止序列，不受內容影響），再掃 <style> 時排除掉落在
//   這些區間內的假匹配；反之掃 <script> 時排除掉落在真正 <style> 區間內的假匹配。
function scanRawTextRegions(t, src){
  const openRe = new RegExp('<' + t + '(\\s[^>]*)?>', 'gi');
  const closeRe = new RegExp('</' + t + '\\s*>', 'gi');
  const out = []; let m; let pos = 0;
  while(true){
    openRe.lastIndex = pos; m = openRe.exec(src); if(!m) break;
    const contentStart = openRe.lastIndex;
    closeRe.lastIndex = contentStart; const c = closeRe.exec(src);
    if(!c) break;
    out.push({ attrs: m[1] || '', start: m.index, contentStart, contentEnd: c.index, tagEnd: closeRe.lastIndex });
    pos = closeRe.lastIndex;
  }
  return out;
}
// ★ 根本修正（第二輪）：naive 正則掃描除了會誤判「落在 <script> 內部的字面 <style> 文字」，
//   還會誤判「落在 HTML 註解 <!-- ... --> 裡的字面 <style> 文字」——本檔案開頭的版本
//   歷史註解裡就寫著「合併成 11 個`<style>`區塊」這種 markdown 反引號包住的說明文字，
//   naive 正則完全不知道自己正身處註解之中，會把它當成真正的開始標籤。
//   兩種問題的本質相同：naive 正則只看「有沒有這個字元序列」，不知道「目前身處什麼結構中」。
//   根本解法是寫一個「單次掃描、依序切換狀態」的最小型 tokenizer，模擬瀏覽器實際的
//   HTML 解析狀態機：由左到右掃一遍，任何時刻只處於下列其中一種狀態：
//     NORMAL（一般內容）／IN_COMMENT（<!-- 到 -->）／
//     IN_SCRIPT（<script...> 到 </script）／IN_STYLE（<style...> 到 </style）
//   只有在 NORMAL 狀態下看到 <!--／<script／<style 才會切換狀態，
//   這樣「落在其他狀態內部」的字面文字就不可能被誤判成真正的標籤開始。
function tokenizeRawStructure(src){
  const scriptRegions = [];
  const styleRegions = [];
  const scriptOpenRe = /<script(\s[^>]*)?>/gi;
  const styleOpenRe = /<style(\s[^>]*)?>/gi;
  const scriptCloseRe = /<\/script\s*>/gi;
  const styleCloseRe = /<\/style\s*>/gi;
  let i = 0;
  const n = src.length;
  while(i < n){
    if(src.charCodeAt(i) === 60 /* '<' */ && src.startsWith('<!--', i)){
      const end = src.indexOf('-->', i + 4);
      if(end === -1) break;
      i = end + 3;
      continue;
    }
    if(src.charCodeAt(i) === 60){
      scriptOpenRe.lastIndex = i;
      const sm = scriptOpenRe.exec(src);
      if(sm && sm.index === i){
        const contentStart = i + sm[0].length;
        scriptCloseRe.lastIndex = contentStart;
        const cm = scriptCloseRe.exec(src);
        if(!cm) break;
        scriptRegions.push({ attrs: sm[1] || '', start: i, contentStart, contentEnd: cm.index, tagEnd: scriptCloseRe.lastIndex });
        i = scriptCloseRe.lastIndex;
        continue;
      }
      styleOpenRe.lastIndex = i;
      const stm = styleOpenRe.exec(src);
      if(stm && stm.index === i){
        const contentStart = i + stm[0].length;
        styleCloseRe.lastIndex = contentStart;
        const cm = styleCloseRe.exec(src);
        if(!cm) break;
        styleRegions.push({ attrs: stm[1] || '', start: i, contentStart, contentEnd: cm.index, tagEnd: styleCloseRe.lastIndex });
        i = styleCloseRe.lastIndex;
        continue;
      }
    }
    i++;
  }
  return { scriptRegions, styleRegions };
}
let _cachedTokenize = null;
function scanTag(t, src){
  if(!_cachedTokenize || _cachedTokenize.src !== src){
    _cachedTokenize = { src, result: tokenizeRawStructure(src) };
  }
  return t === 'script' ? _cachedTokenize.result.scriptRegions : _cachedTokenize.result.styleRegions;
}

const all = scanTag(tag, html);

// ★ 關鍵修正（第三個踩到的坑）：scanTag 找到的是「所有」真正的 <style>/<script> 標籤，
//   但不是每一個都是「補丁」——例如 <script defer src="...chart.umd.min.js"
//   onerror="window._chartLoadFailed=true"></script> 這種外部腳本載入標籤，
//   如果它剛好緊鄰在某串補丁旁邊，被天真地一起併入合併範圍，新標籤的開始標籤
//   是寫死的 <script id="merged-...">，會把原本的 src／onerror 屬性整個蓋掉、
//   直接讓外部腳本不再載入——第一次執行就是這樣把這個 onerror fallback 弄丟的。
//   修正：只有「只帶 id 屬性、不帶任何其他屬性」的標籤，才算是可合併的補丁；
//   遇到其他帶有 src/onerror/type 等屬性的標籤，視為「不可合併的阻隔物」，
//   會在它前後把執行run從中截斷，不會被併入合併範圍，也不會被移除或改動。
function isPlainIdOnlyTag(t){
  const attrs = t.attrs.trim();
  return /^id\s*=\s*"[^"]*"$/.test(attrs);
}
function isBlankAttrTag(t){
  return t.attrs.trim() === '';
}

const runs = [];
let current = [];
for(let i = 0; i < all.length; i++){
  const t = all[i];
  const mergeable = isPlainIdOnlyTag(t) || isBlankAttrTag(t);
  if(!mergeable){
    if(current.length > 1) runs.push(current);
    current = [];
    continue; // 這個標籤本身不可合併，也會阻斷它前後的相鄰性（不能跨過它合併）
  }
  if(current.length === 0){ current = [t]; continue; }
  const prev = current[current.length - 1];
  const gap = html.slice(prev.tagEnd, t.start);
  if(gap.trim().length === 0){ current.push(t); }
  else { if(current.length > 1) runs.push(current); current = [t]; }
}
if(current.length > 1) runs.push(current);

console.log('找到 ' + runs.length + ' 個可合併的緊鄰執行run');

const manifest = { tag, runs: [] };
let mergedCount = 0;
for(let ri = runs.length - 1; ri >= 0; ri--){
  const run = runs[ri];
  const ids = run.map(t => (t.attrs.match(/id\s*=\s*"([^"]*)"/) || [])[1] || null).filter(Boolean);
  const pieces = run.map(t => html.slice(t.contentStart, t.contentEnd));
  const mergedId = 'merged-' + tag + '-run-' + (ri + 1);
  const traceComment = (tag === 'style' ? '/*' : '//') + ' v2.3.38 階段7合併：原始 id 依序為 ' + ids.join('、') + (tag === 'style' ? ' */' : '');
  const SEP = '\n/* --v2.3.38-piece-boundary-marker-do-not-remove-- */\n';
  const mergedContent = '\n' + traceComment + '\n' + pieces.join(tag === 'style' ? SEP : '\n//--v2.3.38-piece-boundary-marker-do-not-remove--\n');
  const openTagStr = '<' + tag + ' id="' + mergedId + '">';
  const closeTagStr = '</' + tag + '>';
  const whole = openTagStr + mergedContent + closeTagStr;

  manifest.runs.unshift({ mergedId, ids, pieces }); // unshift 恢復成由前到後的原始順序，方便閱讀

  const rangeStart = run[0].start;
  const rangeEnd = run[run.length - 1].tagEnd;
  html = html.slice(0, rangeStart) + whole + html.slice(rangeEnd);
  mergedCount += run.length;
}

fs.writeFileSync(file, html);
if(manifestPath) fs.writeFileSync(manifestPath, JSON.stringify(manifest));
console.log('已完成：' + runs.length + ' 個 run，合計 ' + mergedCount + ' 個原始標籤 → ' + runs.length + ' 個合併後標籤（淨減少 ' + (mergedCount - runs.length) + '）');
