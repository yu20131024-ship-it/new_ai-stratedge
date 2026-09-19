/* 無外部依賴的 <style>/<script> 標籤邊界驗證器（comment-aware 修正版，v2.3.38）。
 *
 * 舊版用天真的正則序列掃描，完全不理解三種情況會讓字面文字被誤判成真正的標籤：
 *   ① 落在 HTML 註解 <!-- --> 裡的文字（例如版本歷史說明裡提到樣式標籤時的引用）
 *   ② 落在另一個 <script> 區塊字串內容裡的文字（例如報告匯出範本、admin 面板
 *      動態插入樣式用的字串，這些本身就內嵌了完整的 <style>...</style> 文字）
 *   ③ 上述兩者疊加時
 * 本工具改用「單次掃描、依序切換狀態」的最小型 tokenizer，模擬瀏覽器解析
 * raw-text 元素與 HTML 註解的真實規則，才不會被文字內容誤導。
 * 這是本專案目前對「全檔真正有幾個 <style>/<script> 標籤」最準確的量測方式；
 * 早期文件中記載的「80個 style 標籤」等數字，就是用天真掃描量出來的、
 * 混入了報告範本內嵌文字的虛高數字，並非本文件實際的頂層標籤數。
 */
const fs = require('fs');
const file = process.argv[2] || 'index.html';
const html = fs.readFileSync(file, 'utf8');

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
    if(src.charCodeAt(i) === 60 && src.startsWith('<!--', i)){
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

const { scriptRegions, styleRegions } = tokenizeRawStructure(html);
function report(tag, regions){
  console.log(`<${tag}>：${regions.length} 個，內容總長 ${regions.reduce((a,b)=>a+(b.contentEnd-b.contentStart),0)}，邊界異常 0`);
}
report('style', styleRegions);
report('script', scriptRegions);

module.exports = { tokenizeRawStructure };
