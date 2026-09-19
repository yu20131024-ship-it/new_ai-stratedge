/* 階段6 前置作業：全站色碼盤點與語意 token 映射建議（零依賴，只分析不改碼）
 *
 * 為什麼先做盤點而不直接 codemod：本檔第3節鐵律第11條記載，階段7曾因為
 * 「把簡寫屬性當成獨立屬性處理」而產生靜態比對抓不到、只有瀏覽器截圖才看得出的錯誤。
 * 色碼收斂同樣會動到 border / background 等簡寫屬性，因此先產出一份可人工覆核的映射表，
 * 確認語意分群正確、再由有瀏覽器的環境執行替換與視覺回歸，才是安全的順序。
 *
 * 用法：node _project-improvement/tools/color-inventory.js index.html [--json]
 */
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');

// ---------- 色彩工具 ----------
function expandHex(h){
  h = h.replace('#','').toLowerCase();
  if(h.length===3) h = h.split('').map(c=>c+c).join('');
  if(h.length===8) h = h.slice(0,6);            // #rrggbbaa → 取 rgb
  return h.length===6 ? h : null;
}
function toRgb(h){ const e=expandHex(h); return e ? [0,2,4].map(i=>parseInt(e.slice(i,i+2),16)) : null; }
function relLum(rgb){
  const [r,g,b] = rgb.map(v=>{ const s=v/255; return s<=0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4); });
  return 0.2126*r + 0.7152*g + 0.0722*b;
}
function contrast(h1,h2){
  const a=toRgb(h1), b=toRgb(h2);
  if(!a||!b) return null;
  const l1=relLum(a), l2=relLum(b);
  return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
}
// 轉成 HSL 以便做語意分群
function toHsl(h){
  const rgb = toRgb(h); if(!rgb) return null;
  const [r,g,b] = rgb.map(v=>v/255);
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn;
  let hue=0;
  if(d){
    if(mx===r) hue=((g-b)/d)%6;
    else if(mx===g) hue=(b-r)/d+2;
    else hue=(r-g)/d+4;
    hue*=60; if(hue<0) hue+=360;
  }
  const l=(mx+mn)/2;
  const s = d===0 ? 0 : d/(1-Math.abs(2*l-1));
  return [Math.round(hue), +(s*100).toFixed(1), +(l*100).toFixed(1)];
}

// ---------- 語意分群 ----------
// 依色相與明度把色碼歸到語意 token。分群規則刻意寫得保守、可人工覆核，
// 不確定的一律歸到 review（需人工判斷），絕不自動猜。
function classify(hex){
  const hsl = toHsl(hex);
  if(!hsl) return 'review';
  const [h,s,l] = hsl;
  // ★ 先看明度再看色相：本專案是深色主題，大量「帶藍調的深色」（如 #102033、#172033）
  //   其實是背景／表面色，不是主色。若先用色相分群會把 300 多種中性深色誤判成 primary。
  if(l < 14) return '--color-bg';
  if(l < 26) return '--color-surface';
  if(l > 93) return '--color-text';
  if(s < 14){                                    // 中間明度的低彩度 → 邊框與次要文字
    if(l < 55) return '--color-border';
    return '--color-text-muted';
  }
  if(h < 15 || h >= 345) return '--color-danger';          // 紅
  if(h < 70)  return '--color-warning';                    // 橘、黃
  if(h < 170) return '--color-success';                    // 綠～青綠
  if(h < 200) return '--color-accent';                     // 青
  if(h < 260) return '--color-primary';                    // 藍
  if(h < 290) return '--color-info';                       // 靛紫
  return 'review';                                         // 紫紅區間人工判斷
}

// ---------- 盤點 ----------
const occurrences = html.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
const counts = new Map();
for(const raw of occurrences){
  const e = expandHex(raw);
  if(!e) continue;
  const key = '#' + e;
  counts.set(key, (counts.get(key) || 0) + 1);
}
const groups = new Map();
for(const [hex, n] of counts){
  const token = classify(hex);
  if(!groups.has(token)) groups.set(token, []);
  groups.get(token).push({ hex, count: n, hsl: toHsl(hex) });
}

const result = {
  distinctColors: counts.size,
  totalOccurrences: occurrences.length,
  groups: {}
};
for(const [token, list] of [...groups].sort((a,b)=>a[0].localeCompare(b[0]))){
  list.sort((a,b)=>b.count-a.count);
  result.groups[token] = {
    colorCount: list.length,
    occurrences: list.reduce((s,x)=>s+x.count,0),
    suggestedValue: list[0].hex,                 // 出現次數最多者作為收斂後的代表值
    colors: list
  };
}

if(process.argv.includes('--json')){
  console.log(JSON.stringify(result, null, 2));
}else{
  console.log('\n=== 全站色碼盤點與語意 token 映射建議 ===\n');
  console.log('相異色碼 ' + result.distinctColors + ' 種，合計出現 ' + result.totalOccurrences + ' 次\n');
  console.log('建議收斂為 ' + Object.keys(result.groups).length + ' 個語意分組：\n');
  for(const [token, g] of Object.entries(result.groups)){
    const flag = token === 'review' ? '  ⚠️ 需人工判斷' : '';
    console.log(token + flag);
    console.log('  色碼 ' + g.colorCount + ' 種／出現 ' + g.occurrences + ' 次／建議代表值 ' + g.suggestedValue);
    console.log('  前 8 名：' + g.colors.slice(0,8).map(c=>c.hex+'('+c.count+')').join(' '));
    console.log('');
  }
  // 對比度速查：各語意色 vs 深色底 / 淺色底
  console.log('--- 建議代表值的對比度速查（WCAG AA：一般文字需 ≥4.5:1、大字/圖示 ≥3:1）---');
  const bg = result.groups['--color-bg'] ? result.groups['--color-bg'].suggestedValue : '#06080d';
  for(const [token, g] of Object.entries(result.groups)){
    if(token === '--color-bg') continue;
    const c = contrast(g.suggestedValue, bg);
    if(c === null) continue;
    const verdict = c >= 4.5 ? '✅ AA 一般文字' : (c >= 3 ? '⚠️ 僅適用大字/圖示' : '❌ 對比不足');
    console.log('  ' + token.padEnd(20) + g.suggestedValue + ' on ' + bg + '  ' + c.toFixed(2) + ':1  ' + verdict);
  }
  console.log('\n提醒：本工具只做分析，不會修改任何檔案。實際替換請在有瀏覽器的環境執行，');
  console.log('      並搭配 visual-regression-check.py 做真實截圖比對（鐵律第 9、11 條）。\n');
}
