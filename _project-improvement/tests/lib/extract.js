// 共用擷取工具：從 index.html 取出「真正的原始碼片段」來跑測試（遵守鐵律第8條：
// 不可另外重寫一份簡化邏輯來測，必須驅動專案裡真實的程式碼）。
const fs = require('fs');
const path = require('path');

function indexPath(){ return path.join(__dirname, '..', '..', '..', 'index.html'); }
function readIndex(file){ return fs.readFileSync(file || indexPath(), 'utf8'); }

// 從整份 HTML 中，依「宣告起點 + 大括號配對（含字串／樣板字串跳脫處理）」擷取完整宣告原始碼。
function extractDeclaration(html, header, open){
  const start = html.indexOf(header);
  if(start === -1) throw new Error('找不到宣告：' + header);
  const OPEN = open || '{';
  const CLOSE = OPEN === '[' ? ']' : '}';
  let i = html.indexOf(OPEN, start);
  if(i === -1) throw new Error('宣告後找不到區塊起點：' + header);
  let depth = 0, inStr = null, inLineComment = false, inBlockComment = false;
  for(; i < html.length; i++){
    const c = html[i], next = html[i+1];
    if(inLineComment){ if(c === '\n') inLineComment = false; continue; }
    if(inBlockComment){ if(c === '*' && next === '/'){ inBlockComment = false; i++; } continue; }
    if(inStr){
      if(c === '\\'){ i++; continue; }
      if(c === inStr) inStr = null;
      continue;
    }
    // ★ 註解內文字可能包含字面上的大括號（例如中文說明裡寫「產生的 } 字元」），
    //   必須先判斷是否在註解裡，否則這種大括號會被誤算進深度、導致區塊提早結束——
    //   本專案 PROGRESS.md 鐵律第9條記載過同一類「文字內容被當成語法結構」的事故。
    if(c === '/' && next === '/'){ inLineComment = true; i++; continue; }
    if(c === '/' && next === '*'){ inBlockComment = true; i++; continue; }
    if(c === '"' || c === "'" || c === '`'){ inStr = c; continue; }
    if(c === OPEN) depth++;
    else if(c === CLOSE){ depth--; if(depth === 0) return html.slice(start, i + 1); }
  }
  throw new Error('括號未配對：' + header);
}
function extractDeclarationArr(html, header){ return extractDeclaration(html, header, '['); }

function extractInlineScripts(html){
  const out = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while((m = re.exec(html))){
    const attrs = m[1] || '';
    if(/\bsrc=/.test(attrs)) continue;
    if(/type\s*=\s*["'](?!text\/javascript|application\/javascript)/.test(attrs)) continue;
    out.push({ attrs, code: m[2], line: html.slice(0, m.index).split('\n').length });
  }
  return out;
}

module.exports = { readIndex, extractDeclaration, extractDeclarationArr, extractInlineScripts, indexPath };
