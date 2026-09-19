/* 階段7 前置分析（修正版）：判斷 30 個 <script id> 補丁能否安全合併進主邏輯。
 *
 * 第一版分析工具有一個嚴重的誤判：用天真的正則表達式抓 const/let/function，
 * 沒有追蹤大括號深度，導致「寫在 function 內部的區域變數」被誤判成「頂層宣告」，
 * 產生 61 組根本不會真的撞名的假警報（例如 v251-voice-summary 裡 function 內部的
 * const d/m/parts，跟主要 script 裡另一個完全不相關 function 內部同名的區域變數，
 * 本來就各自屬於不同的函式作用域，永遠不會衝突）。
 *
 * 這正是本專案鐵律反覆提醒的同一類問題：分析工具本身如果不夠嚴謹，會產生
 * 看似合理、其實錯誤的結論，而錯誤的結論若被直接拿去執行，後果比不分析更糟。
 *
 * 修正：只統計「大括號深度為 0」（也就是真正的 script 頂層，不在任何 function/物件/
 * 區塊內部）的 const/let/class/function 宣告，且正確跳過字串、樣板字串與註解。
 */
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');

function scanTag(tag, src){
  const openRe = new RegExp('<' + tag + '(\\s[^>]*)?>', 'gi');
  const closeRe = new RegExp('</' + tag + '\\s*>', 'gi');
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

// 只找「深度為 0」位置的頂層宣告，正確跳過字串/樣板字串/註解/巢狀區塊
function declaredTopLevelNames(code){
  const names = new Set();
  let depth = 0, inStr = null, inLineComment = false, inBlockComment = false;
  for(let i = 0; i < code.length; i++){
    const c = code[i], next = code[i+1];
    if(inLineComment){ if(c === '\n') inLineComment = false; continue; }
    if(inBlockComment){ if(c === '*' && next === '/'){ inBlockComment = false; i++; } continue; }
    if(inStr){
      if(c === '\\'){ i++; continue; }
      if(c === inStr) inStr = null;
      continue;
    }
    if(c === '/' && next === '/'){ inLineComment = true; i++; continue; }
    if(c === '/' && next === '*'){ inBlockComment = true; i++; continue; }
    if(c === '"' || c === "'" || c === '`'){ inStr = c; continue; }
    if(c === '{' || c === '(' || c === '[') { depth++; continue; }
    if(c === '}' || c === ')' || c === ']') { depth--; continue; }
    if(depth === 0){
      let mm;
      const rest = code.slice(i);
      if((mm = /^(?:const|let|class)\s+([A-Za-z_$][\w$]*)/.exec(rest))){ names.add(mm[1]); }
      else if((mm = /^function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(rest))){ names.add(mm[1]); }
      else if((mm = /^var\s+([A-Za-z_$][\w$]*)/.exec(rest))){ names.add(mm[1]); } // var 本來就是共享全域，一樣要檢查
    }
  }
  return names;
}

const scripts = scanTag('script', html);
const patches = scripts.filter(s => /\bid\s*=\s*"[^"]*"/.test(s.attrs));
const mainScripts = scripts.filter(s => !/\bid\s*=\s*"[^"]*"/.test(s.attrs) && !/\bsrc\s*=/.test(s.attrs));

console.log('補丁 <script id> 共 ' + patches.length + ' 個；主要（無 id、無 src）<script> 共 ' + mainScripts.length + ' 個\n');

const patchInfo = patches.map(p => {
  const idMatch = p.attrs.match(/id\s*=\s*"([^"]*)"/);
  const code = html.slice(p.contentStart, p.contentEnd);
  return { id: idMatch ? idMatch[1] : '(no id)', start: p.start, contentEnd: p.contentEnd, code, names: declaredTopLevelNames(code) };
});

const mainNames = new Set();
mainScripts.forEach(s => { for(const n of declaredTopLevelNames(html.slice(s.contentStart, s.contentEnd))) mainNames.add(n); });

console.log('=== 各補丁的「真正頂層」宣告（深度0，會受合併影響的識別字）===');
patchInfo.forEach(p => console.log('  ' + p.id + '：' + (p.names.size ? [...p.names].join(', ') : '（無頂層宣告，全部包在函式/區塊內，最安全）')));
console.log('');

const collisions = [];
for(let i = 0; i < patchInfo.length; i++){
  for(const n of patchInfo[i].names){
    if(mainNames.has(n)) collisions.push({ name: n, a: patchInfo[i].id, b: '(主要 script)' });
    for(let j = i+1; j < patchInfo.length; j++){
      if(patchInfo[j].names.has(n)) collisions.push({ name: n, a: patchInfo[i].id, b: patchInfo[j].id });
    }
  }
}
console.log('=== 撞名檢查（修正後：只看真正的頂層宣告） ===');
if(collisions.length === 0){
  console.log('沒有發現任何頂層識別字撞名，全部 ' + patches.length + ' 個補丁在名稱層面可以安全合併。\n');
}else{
  console.log('發現 ' + collisions.length + ' 組真正的撞名：');
  collisions.forEach(c => console.log('  「'+c.name+'」同時出現在：'+c.a+' 與 '+c.b));
  console.log('\n這些補丁需要先解決撞名才能合併（其餘補丁不受影響，可以照常合併）。');
}

const safeToMerge = patchInfo.filter(p => !collisions.some(c => c.a === p.id || c.b === p.id));
console.log('\n=== 結論 ===');
console.log('可安全合併：' + safeToMerge.length + ' / ' + patches.length + ' 個');
if(safeToMerge.length < patches.length){
  const unsafe = patchInfo.filter(p => !safeToMerge.includes(p));
  console.log('需要先處理撞名：' + unsafe.map(p=>p.id).join('、'));
}
console.log('\n操作方式：原地拿掉每個「可安全合併」補丁自己的 <script id="...">/</script> 外殼');
console.log('（不搬動位置、不改動任何程式碼文字），JS 執行順序與副作用完全不變——');
console.log('這與「移除標籤邊界前後的整份文件執行語意證明相同」的原理，跟階段6色碼收斂中');
console.log('「換成同值變數」是同一類「純去重複、非行為變更」的安全操作。');
