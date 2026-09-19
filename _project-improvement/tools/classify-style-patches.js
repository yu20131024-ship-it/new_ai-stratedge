const fs = require('fs');
const parse5 = require('parse5');
const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');

function splitTopLevelSelectors(selectorString) {
  // 用 postcss-selector-parser 而不是簡單的 split(',')，因為現代 CSS 選擇器裡的
  // :is(.a,.b,.c) / :not(.a,.b) 這類寫法，逗號是在括號「裡面」，屬於同一條選擇器
  // 的一部分，不能被切開；naive split(',') 會把它們切成殘缺不全的片段。
  const result = [];
  try {
    selectorParser(sels => {
      sels.each(sel => result.push(sel.toString().trim()));
    }).processSync(selectorString);
  } catch (e) {
    result.push(...selectorString.split(',').map(s => s.trim()));
  }
  return result;
}

const htmlPath = process.argv[2];
const html = fs.readFileSync(htmlPath, 'utf-8');
const document = parse5.parse(html, { sourceCodeLocationInfo: true });

function walk(node, cb) { cb(node); if (node.childNodes) for (const c of node.childNodes) walk(c, cb); }
function getAttr(node, name) { const a = (node.attrs || []).find(x => x.name === name); return a ? a.value : null; }
function getText(node) { const t = node.childNodes.find(c => c.nodeName === '#text'); return t ? t.value : ''; }

const styleNodes = [];
walk(document, (n) => { if (n.nodeName === 'style') styleNodes.push(n); });

// 只看「真正在主頁面DOM裡」的style補丁（排除位於匯出報告樣板字串內的假標籤，
// 判斷方式：sourceCodeLocation存在且落在真實<html>結構內，parse5本身已經正確處理，
// 不會把樣板字串內容誤判成真正的DOM節點，所以這裡蒐集到的本來就已經是「真的」）。
const patches = [];
for (const node of styleNodes) {
  const id = getAttr(node, 'id');
  if (!id) continue;
  const content = getText(node);
  const loc = node.sourceCodeLocation;
  const importantCount = (content.match(/!important/g) || []).length;
  const ruleCount = (content.match(/\{/g) || []).length;
  let selectors = [];
  try {
    const root = postcss.parse(content);
    root.walkRules(rule => {
      selectors.push(...splitTopLevelSelectors(rule.selector));
    });
  } catch (e) {
    console.log(`[CSS解析失敗] ${id}：${e.message}`);
    selectors = (content.match(/[.#][a-zA-Z][a-zA-Z0-9_-]*/g) || [])
      .filter(s => !/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{4}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/.test(s));
  }
  selectors = [...new Set(selectors.map(s => s.trim()))];
  patches.push({
    id,
    startLine: loc.startTag.startLine,
    endLine: loc.endTag.endLine,
    chars: content.length,
    ruleCount,
    importantCount,
    selectors,
    content
  });
}

// 分類規則：依 id 命名關鍵字 + 內容關鍵字判斷主題類別
function classify(p) {
  const id = p.id.toLowerCase();
  const c = p.content.toLowerCase();
  const tags = [];
  if (/color|red|white|dark|bright|graywhite|black/.test(id) || /color\s*:/.test(c)) tags.push('配色');
  if (/font|typography|dunbar|taipei/.test(id)) tags.push('字型');
  if (/gap|spacing|padding|margin|shrink|overlap|center|align/.test(id)) tags.push('間距版面');
  if (/hover|click|jump|active|focus/.test(id)) tags.push('互動狀態');
  if (/mobile|responsive|windows|cross-platform|compatibility|select-dropdown/.test(id)) tags.push('跨裝置相容');
  if (/readability|title|label|text/.test(id)) tags.push('文字可讀性');
  if (/lock|final|force/.test(id)) tags.push('強制覆蓋層');
  if (/fix|bug|garbled/.test(id)) tags.push('bug修正');
  if (/modal|panel|dashboard|card|pill/.test(id)) tags.push('元件外觀');
  if (tags.length === 0) tags.push('待人工分類');
  return tags;
}

for (const p of patches) p.categories = classify(p);

// 按出現順序（等同patch套用順序、也就是CSS層疊優先權由低到高）排序
patches.sort((a, b) => a.startLine - b.startLine);

// 統計：哪些選擇器被最多不同補丁碰過（代表疊加層數最深、合併時風險最高，
// 因為要保留「最後生效的規則」，任何一個環節漏看就會讓畫面跑掉）
const selectorHitCount = new Map();
for (const p of patches) {
  for (const sel of p.selectors) {
    if (!selectorHitCount.has(sel)) selectorHitCount.set(sel, []);
    selectorHitCount.get(sel).push(p.id);
  }
}
const hotSelectors = [...selectorHitCount.entries()]
  .filter(([, ids]) => ids.length >= 4)
  .sort((a, b) => b[1].length - a[1].length);

// 分類統計
const categoryCount = {};
for (const p of patches) for (const cat of p.categories) categoryCount[cat] = (categoryCount[cat] || 0) + 1;

const output = {
  totalPatches: patches.length,
  totalImportant: patches.reduce((s, p) => s + p.importantCount, 0),
  categoryCount,
  hotSelectors: hotSelectors.map(([sel, ids]) => ({ selector: sel, hitCount: ids.length, patchIds: ids })),
  patches: patches.map(p => ({
    id: p.id, startLine: p.startLine, endLine: p.endLine, chars: p.chars,
    ruleCount: p.ruleCount, importantCount: p.importantCount,
    categories: p.categories, topSelectors: p.selectors.slice(0, 5)
  }))
};

fs.writeFileSync(process.argv[3] || 'style-inventory.json', JSON.stringify(output, null, 2));
console.log(`共 ${patches.length} 個真實style補丁，已寫入 ${process.argv[3] || 'style-inventory.json'}`);
console.log('分類統計：', JSON.stringify(categoryCount, null, 2));
console.log(`\n被4個以上不同補丁碰過的「熱點選擇器」共 ${hotSelectors.length} 個（合併時風險最高，需特別小心順序）`);
