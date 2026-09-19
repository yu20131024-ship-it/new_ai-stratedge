const fs = require('fs');
const parse5 = require('parse5');

const html = fs.readFileSync(process.argv[2], 'utf-8');

const document = parse5.parse(html, { sourceCodeLocationInfo: true });

function walk(node, scripts) {
  if (node.nodeName === 'script') {
    scripts.push(node);
  }
  if (node.childNodes) {
    for (const child of node.childNodes) walk(child, scripts);
  }
}

const scripts = [];
walk(document, scripts);

console.log(`parse5（符合HTML5規範）解析出的 <script> 元素數量：${scripts.length}\n`);

scripts.forEach((s, i) => {
  const loc = s.sourceCodeLocation;
  const textNode = s.childNodes.find(c => c.nodeName === '#text');
  const content = textNode ? textNode.value : '';
  const idAttr = (s.attrs || []).find(a => a.name === 'id');
  const startLine = loc ? loc.startLine : '?';
  const endLine = loc ? loc.endLine : '?';
  console.log(`#${i}  id=${idAttr ? idAttr.value : '(無)'}  行 ${startLine} ~ ${endLine}  內容長度=${content.length}`);
});
