/* 階段3 驗證：歸因模擬改為「可重現的蒙地卡羅」＋資料來源誠實標示
 *
 * 測試方式（遵守鐵律第8條）：直接從 index.html 擷取專案裡真正的 SimRandom、
 * 歸因模擬函式與 DATA_SOURCE 常數，在 Node 中實際跑完整條模擬管線。
 *
 * 用法：node _project-improvement/tests/stage3-deterministic-simulation.test.js
 */
const { readIndex, extractDeclaration } = require('./lib/extract.js');
const html = readIndex();

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  ✅ ' + name + (detail ? '　' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '　' + detail : '')); }
}

// ---- 載入真實原始碼 ----
const src = [
  'const DATA_SOURCE = ' + extractDeclaration(html, 'const DATA_SOURCE = {').split('=').slice(1).join('=').trim() + ';',
  extractDeclaration(html, 'const SimRandom = (function(){') + ')();',
  'const MONTE_CARLO_RUNS = ' + (html.match(/const MONTE_CARLO_RUNS = (\d+)/) || [])[1] + ';',
  'const ATTRIB_JOURNEY_SAMPLE = ' + (html.match(/const ATTRIB_JOURNEY_SAMPLE = (\d+)/) || [])[1] + ';',
  extractDeclaration(html, 'const CHANNEL_ATTRIB_PROFILES'),
  extractDeclaration(html, 'function attribChannelProfile(ch){'),
  extractDeclaration(html, 'function attribWeightedPick(channels, posKey){'),
  extractDeclaration(html, 'function attribGenerateJourneys(channels, n){'),
  extractDeclaration(html, 'function attribNormalizeToPct(creditMap, channels){'),
  extractDeclaration(html, 'function attribMarkovDataDriven(channels, journeys){'),
  extractDeclaration(html, 'function simulateAttribution(channels){')
].join('\n\n');
const mod = new Function(src + '\nreturn {SimRandom, simulateAttribution, DATA_SOURCE, MONTE_CARLO_RUNS};')();

console.log('\n=== 階段3：可重現模擬與資料來源標示 驗證 ===\n');

// ① 亂數產生器本身：同種子必得同序列、不同種子必得不同序列
{
  const a = []; mod.SimRandom.seed('seed-A'); for(let i=0;i<50;i++) a.push(mod.SimRandom.next());
  const b = []; mod.SimRandom.seed('seed-A'); for(let i=0;i<50;i++) b.push(mod.SimRandom.next());
  const c = []; mod.SimRandom.seed('seed-B'); for(let i=0;i<50;i++) c.push(mod.SimRandom.next());
  check('同一種子產生逐位元一致的序列', JSON.stringify(a) === JSON.stringify(b));
  check('不同種子產生不同序列（不是退化成常數）', JSON.stringify(a) !== JSON.stringify(c));
  check('輸出值域落在 [0,1)', a.every(v => v >= 0 && v < 1));
  // 均勻性粗檢：50,000 次抽樣分 10 桶，每桶應接近 5,000（容許 ±15%）
  const buckets = new Array(10).fill(0);
  mod.SimRandom.seed('uniformity');
  for(let i=0;i<50000;i++) buckets[Math.floor(mod.SimRandom.next()*10)]++;
  const worst = Math.max(...buckets.map(v => Math.abs(v - 5000) / 5000));
  check('均勻性足以支撐蒙地卡羅（10 桶最大偏差 < 15%）', worst < 0.15, '最大偏差 ' + (worst*100).toFixed(1) + '%');
}

// ② 整條模擬管線可重現
const CH = ['Facebook / Instagram','Google 搜尋廣告','LINE 官方帳號','Email Marketing'];
{
  const r1 = mod.simulateAttribution(CH);
  const r2 = mod.simulateAttribution(CH);
  check('同一組管道重算兩次，五種歸因模型結果完全一致',
    JSON.stringify(r1.models) === JSON.stringify(r2.models));
  check('樣本數與成交數也完全一致',
    r1.journeySample === r2.journeySample && r1.convertedCount === r2.convertedCount,
    r1.journeySample + ' 筆樣本／' + r1.convertedCount + ' 筆成交');

  const r3 = mod.simulateAttribution(['Facebook / Instagram','TikTok','Google 搜尋廣告']);
  check('換一組管道會得到不同結果（不是把結果寫死）',
    JSON.stringify(r3.models) !== JSON.stringify(r1.models));
}

// ③ 結果的數學性質仍然正確
{
  const r = mod.simulateAttribution(CH);
  Object.keys(r.models).forEach(k => {
    const sum = CH.reduce((s, c) => s + r.models[k][c], 0);
    check('「' + k + '」模型各管道百分比加總為 100%', Math.abs(sum - 100) < 0.001, sum.toFixed(4) + '%');
  });
}

// ④ 資料來源誠實標示
{
  const r = mod.simulateAttribution(CH);
  check('模擬結果自帶資料來源標示（模擬推估）',
    r.dataSource && r.dataSource.key === 'monte-carlo' && /不是真實投放數據|非真實/.test(r.dataSource.hint));
  check('模擬次數已提高到 10,000 次', r.monteCarloRuns === 10000, '實測 ' + r.monteCarloRuns);
  check('結果標示為可重現', r.reproducible === true);
  const keys = Object.keys(mod.DATA_SOURCE);
  check('DATA_SOURCE 抽象層涵蓋 6 種來源分類並各有說明',
    keys.length === 6 && keys.every(k => mod.DATA_SOURCE[k].label && mod.DATA_SOURCE[k].hint && mod.DATA_SOURCE[k].tone));
  check('已為未來串接真實 API 預留 live-api 分類', !!mod.DATA_SOURCE.LIVE_API);
}

// ⑤ 靜態檢查：對外呈現的 Math.random() 已清乾淨
{
  // 先剝掉 HTML 註解、JS 區塊註解與行註解，避免把「說明文字裡提到的 Math.random()」誤判成實際呼叫
  const inScript = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  const hits = (inScript.match(/Math\.random\(\)/g) || []).length;
  // 全檔僅允許兩處真亂數，兩處都是「刻意需要不可預測」而非「該被種子化卻沒改到」：
  //   ① reportId：報告編號需要唯一且不可預測
  //   ② 重試退避的 jitter：抖動的價值就在於各用戶端彼此不同步，可重現反而有害
  const reportIdLine = /const reportId = 'MKT-'[^\n]*Math\.random\(\)/.test(inScript);
  const jitterLine = /wait \* 0\.25 \* Math\.random\(\)/.test(inScript);
  check('全檔僅剩 2 處 Math.random()，且皆為刻意保留（報告編號、重試抖動）',
    hits === 2 && reportIdLine && jitterLine, '實測 ' + hits + ' 處');
  check('歸因模擬與畫面呈現處已全面改用 SimRandom',
    (inScript.match(/SimRandom\.next\(\)/g) || []).length >= 4);
}

console.log('\n結果：' + pass + ' 通過 / ' + fail + ' 失敗\n');
process.exit(fail ? 1 : 0);
