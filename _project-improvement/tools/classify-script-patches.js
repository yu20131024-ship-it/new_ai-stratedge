const fs = require('fs');
const parse5 = require('parse5');

const htmlPath = process.argv[2];
const html = fs.readFileSync(htmlPath, 'utf-8');
const document = parse5.parse(html, { sourceCodeLocationInfo: true });

function walk(node, cb) { cb(node); if (node.childNodes) for (const c of node.childNodes) walk(c, cb); }
function getAttr(node, name) { const a = (node.attrs || []).find(x => x.name === name); return a ? a.value : null; }
function getText(node) { const t = node.childNodes.find(c => c.nodeName === '#text'); return t ? t.value : ''; }

const scriptNodes = [];
walk(document, (n) => { if (n.nodeName === 'script') scriptNodes.push(n); });

const patches = [];
for (const node of scriptNodes) {
  const id = getAttr(node, 'id');
  if (!id) continue;
  const content = getText(node);
  const loc = node.sourceCodeLocation;
  const funcNames = [...new Set((content.match(/function\s+([a-zA-Z0-9_$]+)/g) || []).map(m => m.replace(/function\s+/, '')))];
  const domReady = /DOMContentLoaded/.test(content);
  const usesInterval = /setInterval\(/.test(content);
  const usesTimeout = /setTimeout\(/.test(content);
  const domOpsCount = (content.match(/querySelector|getElementById|getElementsBy/g) || []).length;
  const modifiesStyle = /\.style\.|classList\.(add|remove|toggle)|\.style\s*=/.test(content);
  const isIIFE = /^\s*\(\s*(async\s+)?function\s*\(/.test(content) || /^\s*\(\s*\(\s*\)\s*=>/.test(content);
  patches.push({
    id,
    startLine: loc.startTag.startLine,
    endLine: loc.endTag.endLine,
    chars: content.length,
    funcNames,
    domReady,
    usesInterval,
    usesTimeout,
    domOpsCount,
    modifiesStyle,
    isIIFE
  });
}

patches.sort((a, b) => a.startLine - b.startLine);

function classify(p) {
  const id = p.id.toLowerCase();
  const tags = [];
  if (/dashboard|export|chart/.test(id)) tags.push('匯出/圖表功能');
  if (/gateway|api|provider/.test(id)) tags.push('AI供應商相關');
  if (/voice/.test(id)) tags.push('語音功能');
  if (/sensitivity|panel/.test(id)) tags.push('分析面板功能');
  if (/compliance|check/.test(id)) tags.push('合規檢查');
  if (/benchmark|freshness/.test(id)) tags.push('基準資料');
  if (/blur|focus|reset/.test(id)) tags.push('視窗事件處理');
  if (p.modifiesStyle) tags.push('動態改樣式');
  if (p.domReady) tags.push('頁面初始化');
  if (tags.length === 0) tags.push('待人工分類');
  return tags;
}
for (const p of patches) p.categories = classify(p);

fs.writeFileSync(process.argv[3] || 'script-inventory.json', JSON.stringify({ totalPatches: patches.length, patches }, null, 2));
console.log(`共 ${patches.length} 個真實script補丁，已寫入 ${process.argv[3] || 'script-inventory.json'}`);
console.log('IIFE包裝(作用域獨立、風險較低):', patches.filter(p=>p.isIIFE).length);
console.log('非IIFE(頂層作用域、需小心合併):', patches.filter(p=>!p.isIIFE).length);
console.log('含DOMContentLoaded監聽器:', patches.filter(p=>p.domReady).length);
