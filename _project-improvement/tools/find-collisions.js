const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const htmlPath = process.argv[2];
const html = fs.readFileSync(htmlPath, 'utf-8');

const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/g;
let m;
let idx = -1;
const scripts = [];
while ((m = scriptRe.exec(html)) !== null) {
  idx++;
  const attrs = m[1];
  const content = m[2];
  const idMatch = /id="([^"]*)"/.exec(attrs);
  const startOffset = m.index + m[0].indexOf('>', attrs.length) + 1;
  scripts.push({ idx, id: idMatch ? idMatch[1] : null, content, startOffset });
}

function offsetToLine(offset) {
  let line = 1;
  for (let i = 0; i < offset; i++) if (html[i] === '\n') line++;
  return line;
}

// 只分析「頂層作用域」的 script（開頭不是 IIFE 包裝的），
// 因為這些才會真正共用同一個全域 scope，彼此宣告同名變數/函式會互相覆蓋。
function isIIFE(src) {
  const t = src.trim();
  return /^\(\s*(async\s+)?function\b/.test(t) || /^\(\s*\(\s*\)\s*=>/.test(t) || /^\(\s*async\s*\(\s*\)\s*=>/.test(t);
}

const topLevelDecls = new Map(); // name -> [{scriptIdx, id, line, kind}]

for (const s of scripts) {
  const src = s.content.trim();
  if (!src) continue;
  if (isIIFE(src)) continue; // 有包裝，作用域獨立，不列入碰撞分析

  let ast;
  try {
    ast = acorn.parse(s.content, { ecmaVersion: 2022, sourceType: 'script', allowReturnOutsideFunction: true });
  } catch (e) {
    console.log(`[無法解析] script #${s.idx} id=${s.id}：${e.message}`);
    continue;
  }

  for (const node of ast.body) {
    let names = [];
    let kind = node.type;
    if (node.type === 'FunctionDeclaration' && node.id) {
      names.push(node.id.name);
      kind = 'function';
    } else if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        if (decl.id.type === 'Identifier') names.push(decl.id.name);
      }
      kind = node.kind; // var/let/const
    } else if (node.type === 'ClassDeclaration' && node.id) {
      names.push(node.id.name);
      kind = 'class';
    }
    for (const name of names) {
      const line = offsetToLine(s.startOffset + node.start);
      if (!topLevelDecls.has(name)) topLevelDecls.set(name, []);
      topLevelDecls.get(name).push({ scriptIdx: s.idx, id: s.id, line, kind });
    }
  }
}

console.log('=== 跨頂層script區塊、名稱重複的全域宣告（真正會互相覆蓋的碰撞） ===\n');
let collisionCount = 0;
for (const [name, occurrences] of topLevelDecls) {
  if (occurrences.length > 1) {
    collisionCount++;
    console.log(`「${name}」出現 ${occurrences.length} 次：`);
    for (const o of occurrences) {
      console.log(`   - script #${o.scriptIdx} (id=${o.id || '無id'})，第 ${o.line} 行，宣告方式：${o.kind}`);
    }
    console.log('');
  }
}
if (collisionCount === 0) console.log('沒有發現碰撞。');
else console.log(`共發現 ${collisionCount} 個名稱有碰撞。`);
