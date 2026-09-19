// _project-improvement/tools/extract-root-variables.js
//
// 追蹤 index.html 裡所有 :root { --xxx: ... } 定義（可能分散在主樣式表與多個
// style 補丁裡），依文件出現順序（也就是實際套用順序）算出「每個CSS變數目前
// 真正生效的值」——後面定義的會蓋過前面的，這份輸出就是最終結果。
//
// 用法：node _project-improvement/tools/extract-root-variables.js index.html

const fs = require('fs');
const parse5 = require('parse5');
const postcss = require('postcss');

const htmlPath = process.argv[2];
const html = fs.readFileSync(htmlPath, 'utf-8');
const document = parse5.parse(html, { sourceCodeLocationInfo: true });

function walk(node, cb) { cb(node); if (node.childNodes) for (const c of node.childNodes) walk(c, cb); }
function getAttr(node, name) { const a = (node.attrs || []).find(x => x.name === name); return a ? a.value : null; }
function getText(node) { const t = node.childNodes.find(c => c.nodeName === '#text'); return t ? t.value : ''; }

const styleNodes = [];
walk(document, (n) => { if (n.nodeName === 'style') styleNodes.push(n); });

const finalValue = new Map(); // 變數名 -> { value, source, line }
let rootBlockCount = 0;

for (const node of styleNodes) {
  const id = getAttr(node, 'id') || '(主樣式表)';
  const content = getText(node);
  const loc = node.sourceCodeLocation;
  try {
    const root = postcss.parse(content);
    root.walkRules(rule => {
      // 只看真正的 :root，不含 @media 條件內的版本（那些是「特定情境才生效」，
      // 不是預設一律生效的值，先不列入這份「最終生效值」總表，避免混淆）。
      if (rule.selector.trim() === ':root' && rule.parent.type === 'root') {
        rootBlockCount++;
        rule.walkDecls(decl => {
          finalValue.set(decl.prop, { value: decl.value, source: id, line: loc.startTag.startLine });
        });
      }
    });
  } catch (e) {
    console.log(`[CSS解析失敗] ${id}：${e.message}`);
  }
}

console.log(`共有 ${rootBlockCount} 個 :root 區塊，定義過 ${finalValue.size} 個不同的CSS變數名稱\n`);

const bySource = {};
for (const [, v] of finalValue) bySource[v.source] = (bySource[v.source] || 0) + 1;
console.log('=== 目前實際生效值的來源分布 ===');
for (const [src, cnt] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
  console.log(`${cnt}個變數的最終值來自: ${src}`);
}

const outPath = process.argv[3];
if (outPath) {
  const sorted = [...finalValue.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let out = `## CSS 變數最終生效值總表（共 ${sorted.length} 個變數）\n\n`;
  out += '| CSS變數 | 目前實際生效的值 | 生效值來自哪個補丁 |\n|---|---|---|\n';
  for (const [k, v] of sorted) out += `| \`${k}\` | \`${v.value}\` | ${v.source} |\n`;
  fs.writeFileSync(outPath, out);
  console.log(`\n已寫入完整表格：${outPath}`);
}
