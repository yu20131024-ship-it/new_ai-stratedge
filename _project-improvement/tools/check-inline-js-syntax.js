/* 逐一 <script> 區塊 node --check 語法驗證（comment-aware 修正版，v2.3.38）。
 * 舊版用天真的正則掃描，會被 HTML 註解或其他 script 字串內嵌的字面 <style>/<script>
 * 文字誤導（見 verify-tag-boundaries-nodeps.js 開頭的說明），導致誤判某段內容的
 * 起訖範圍，把不相關的文字送去做語法檢查、跳出一堆看似嚇人其實無關的假錯誤。
 * 本工具改用同一套 comment-aware tokenizer。
 */
const fs = require('fs'), cp = require('child_process'), os = require('os'), path = require('path');
const { tokenizeRawStructure } = require('./verify-tag-boundaries-nodeps.js');

const file = process.argv[2] || 'index.html';
const html = fs.readFileSync(file, 'utf8');
const { scriptRegions } = tokenizeRawStructure(html);

let bad = 0, checked = 0;
scriptRegions.forEach((region, i) => {
  const attrs = region.attrs || '';
  if(/\bsrc=/.test(attrs)) return;
  if(/type\s*=\s*["'](?!text\/javascript|application\/javascript)/.test(attrs)) return;
  const code = html.slice(region.contentStart, region.contentEnd);
  const f = path.join(os.tmpdir(), 'blk' + i + '.js');
  fs.writeFileSync(f, code);
  checked++;
  try{ cp.execSync('node --check ' + f, { stdio: 'pipe' }); }
  catch(e){
    bad++;
    console.log('SYNTAX ERROR in script block #' + i + ' (line ' + (html.slice(0, region.start).split('\n').length) + ')');
    console.log(e.stderr.toString().split('\n').slice(0, 6).join('\n'));
  }
  fs.unlinkSync(f);
});
console.log('inline script blocks checked: ' + checked + ', syntax errors: ' + bad);
process.exit(bad ? 1 : 0);
