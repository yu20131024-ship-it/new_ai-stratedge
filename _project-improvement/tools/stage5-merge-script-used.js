// _project-improvement/tools/stage5-merge-script-used.js
//
// 這是階段5實際執行過、用來合併「真正逐位元組緊鄰」的連續小型style補丁的腳本，
// 保留在這裡作為稽核紀錄（可以看到當時到底是怎麼判斷、怎麼合併的），**不是**
// 一支通用工具——它的合併範圍是根據執行當下 index.html 裡「還剩下哪些補丁」
// 動態算出來的，每次執行結果都不一樣，不能直接對現在的 index.html 重新執行
// 一次就期待得到有意義的結果。
//
// 如果未來階段6/7要處理剩下的補丁，建議參考這支腳本的邏輯重新寫一份，並且：
// 1. 務必採用這裡「真正逐位元組緊鄰（gap必須是純空白）」的相鄰判斷方式——
//    階段5第一版曾經只檢查「中間沒有其他style補丁」就誤判為相鄰，結果把中間一整段
//    不是style標籤的內容（例如一段完整的<script>樣板字面值）整段吞掉，直接讓
//    body整個變空白。詳見 PROGRESS.md 階段5章節的完整記錄。
// 2. 產生的說明註解裡絕對不能包含字面上的 "</style" 文字（哪怕是要拿來描述
//    「少了幾個</style>邊界」也不行），會被瀏覽器提前截斷標籤。
// 3. 合併完一定要跑 verify-style-boundaries.js + visual-regression-check.py
//    做完整驗證，不能只看CSS規則內容比對。

const fs = require('fs');
const parse5 = require('parse5');

const htmlPath = process.argv[2];
const outPath = process.argv[3];
const html = fs.readFileSync(htmlPath, 'utf-8');
const document = parse5.parse(html, { sourceCodeLocationInfo: true });

function walk(node, cb) { cb(node); if (node.childNodes) for (const c of node.childNodes) walk(c, cb); }
function getAttr(node, name) { const a = (node.attrs || []).find(x => x.name === name); return a ? a.value : null; }
function getText(node) { const t = node.childNodes.find(c => c.nodeName === '#text'); return t ? t.value : ''; }

const styleNodes = [];
walk(document, (n) => { if (n.nodeName === 'style') styleNodes.push(n); });

const patches = [];
for (const node of styleNodes) {
  const id = getAttr(node, 'id');
  if (!id) continue;
  const content = getText(node);
  const loc = node.sourceCodeLocation;
  const ruleCount = (content.match(/\{/g) || []).length;
  const hasRoot = /:root/.test(content);
  patches.push({
    id, content, ruleCount, hasRoot,
    fullStart: loc.startOffset,
    fullEnd: loc.endOffset
  });
}
patches.sort((a, b) => a.fullStart - b.fullStart);

const candidateIds = new Set();
for (const p of patches) {
  if (p.hasRoot) continue;
  if (p.ruleCount > 15) continue;
  candidateIds.add(p.id);
}

const runs = [];
let current = [];
for (const p of patches) {
  if (candidateIds.has(p.id)) {
    if (current.length === 0) {
      current.push(p);
    } else {
      // 關鍵防呆：一定要「真正逐位元組緊鄰」（中間最多只能是空白字元）才能算同一串，
      // 不能只看「中間沒有其他style補丁」就當作相鄰——這支腳本第一版就是犯了這個錯，
      // 中間如果夾著一大段不是<style>的內容（例如整段<script>樣板字面值），沒有任何
      // style標籤但内容多達數千行，原本的判斷方式會誤判成「相鄰」，結果合併時把中間
      // 這一大段完全吞掉，直接讓整個HTML結構壞掉（實測發現body整個變空白）。
      const gap = html.slice(current[current.length - 1].fullEnd, p.fullStart);
      if (/^\s*$/.test(gap)) {
        current.push(p);
      } else {
        if (current.length >= 2) runs.push(current);
        current = [p];
      }
    }
  } else {
    if (current.length >= 2) runs.push(current);
    current = [];
  }
}
if (current.length >= 2) runs.push(current);

console.log(`共 ${runs.length} 串可安全合併的連續補丁，涵蓋 ${runs.reduce((s,r)=>s+r.length,0)} 個補丁`);

// 由後往前替換，避免前面替換後改變後面的字元位移
let result = html;
for (let i = runs.length - 1; i >= 0; i--) {
  const run = runs[i];
  const start = run[0].fullStart;
  const end = run[run.length - 1].fullEnd;
  const mergedId = `stage5-merged-batch-${i + 1}`;
  const originalIds = run.map(p => p.id).join(', ');
  const combinedCss = run.map(p => p.content).join('');
  const replacement = `<style id="${mergedId}">\n/* 階段5合併：原本是 ${run.length} 個連續相鄰的獨立補丁，合併前後CSS內容與相對順序逐字元不變，只是少了中間 ${run.length - 1} 組多餘的樣式標籤邊界。原始補丁id依序為： ${originalIds} */\n${combinedCss}\n</style>`;
  result = result.slice(0, start) + replacement + result.slice(end);
}

fs.writeFileSync(outPath, result, 'utf-8');
console.log(`已寫入 ${outPath}`);
