// _project-improvement/tools/verify-style-boundaries.js
//
// 用符合HTML5規範的parse5解析器驗證 <style> 標籤邊界是否正確，並回報每個
// <style> 元素實際的文字內容長度。
//
// 為什麼需要這支工具：階段5第一次嘗試合併style補丁時，說明用的註解文字裡
// 不小心寫了字面上的 "</style>"（拿它來描述「少了幾組</style><style id=...>
// 邊界」），結果瀏覽器（以及parse5）在解析HTML時，根本不管這段文字是不是寫在
// CSS註解裡——HTML的標籤字元掃描發生在「認得出這是CSS註解」之前，只要看到
// </style 這幾個字元就會把當下這個<style>標籤提前結束。因為HTML解析對這種
// 錯誤有一定的容錯（後面的文字會被當成別的東西繼續解析），最後拼出來的CSS
// 規則數量、順序甚至剛好還是對的，光看「CSS規則內容」的比對完全看不出問題，
// 只有直接檢查「真正有幾個<style>標籤、每個的邊界在哪裡」才抓得到。
//
// 用法：node _project-improvement/tools/verify-style-boundaries.js index.html

const fs = require('fs');
const parse5 = require('parse5');

const htmlPath = process.argv[2];
const html = fs.readFileSync(htmlPath, 'utf-8');
const document = parse5.parse(html, { sourceCodeLocationInfo: true });

function walk(node, cb) { cb(node); if (node.childNodes) for (const c of node.childNodes) walk(c, cb); }
function getAttr(node, name) { const a = (node.attrs || []).find(x => x.name === name); return a ? a.value : null; }
function getText(node) { const t = node.childNodes.find(c => c.nodeName === '#text'); return t ? t.value : ''; }

const styleNodes = [];
walk(document, (n) => { if (n.nodeName === 'style') styleNodes.push(n); });

console.log(`parse5（符合HTML5規範）解析出的 <style> 元素數量：${styleNodes.length}\n`);

let suspicious = 0;
styleNodes.forEach((node, i) => {
  const id = getAttr(node, 'id') || '(無id，可能是主樣式表或格式異常的殘留片段)';
  const content = getText(node);
  const loc = node.sourceCodeLocation;
  const ruleCount = (content.match(/\{/g) || []).length;
  // 一個正常的style補丁至少應該有開頭的id/註解或是一條CSS規則；長度極短、
  // 又沒有id、又沒有任何規則的，很可能就是「被提前截斷後留下的殘渣」。
  const isSuspicious = content.length < 30 && ruleCount === 0;
  if (isSuspicious) suspicious++;
  const flag = isSuspicious ? '⚠️  可疑（內容極短且無CSS規則，可能是標籤被提前截斷的殘留）' : '';
  console.log(`#${i}  id=${id}  行${loc.startTag.startLine}-${loc.endTag.endLine}  內容長度=${content.length}  規則數=${ruleCount} ${flag}`);
});

console.log('');
if (suspicious > 0) {
  console.log(`❌ 發現 ${suspicious} 個可疑的style標籤，很可能是提前截斷造成的殘留，請檢查是否有補丁內容意外包含字面上的 "</style" 文字。`);
  process.exitCode = 1;
} else {
  console.log('✅ 沒有發現可疑的殘留style標籤。');
}
