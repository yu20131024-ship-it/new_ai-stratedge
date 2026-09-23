const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'../../index.html'),'utf8');
let pass=0,fail=0;
function check(name,ok,detail=''){ if(ok){pass++;console.log('  ✅ '+name+(detail?'　'+detail:''));}else{fail++;console.log('  ❌ '+name+(detail?'　'+detail:''));} }
console.log('\n=== API Provider / Model 可配置性檢查 ===\n');
const providers=['claude','gemini','agnes','nvidia','groq','openrouter','mistral'];
for(const p of providers){
  check(p+' 有 API Key 輸入欄位', html.includes('api-key-input-'+p));
  check(p+' 有可編輯 Model ID 欄位', html.includes('api-model-input-'+p));
  check(p+' 有 provider label', new RegExp(p+':').test(html.match(/const PROVIDER_LABEL=\{[^;]+;/)?.[0]||''));
}
check('Agnes 不再直接寫死 agnes-2.0-flash 到 callAgnes request body', !/model:'agnes-2\.0-flash'/.test(html));
check('Agnes 預設設定為 agnes-2.5-flash', /agnes:\{model:'agnes-2\.5-flash'/.test(html));
check('Agnes 3.0 模型可由 UI 輸入', /agnes-3\.0-flash/.test(html));
check('Claude Web Search 已使用 20260318', /web_search_20260318/.test(html));
check('四個新增 OpenAI-compatible provider 共用 generic call 路徑', /callOpenAICompatibleProvider\(provider/.test(html) && /\['nvidia','groq','openrouter','mistral'\]\.includes\(provider\)/.test(html));
check('沒有把第三方 API Key 寫進程式碼', !/api[-_ ]?key\s*[:=]\s*['\"][^'\"]{20,}/i.test(html));
check('官方 Base URL 已建立', ['https://integrate.api.nvidia.com/v1','https://api.groq.com/openai/v1','https://openrouter.ai/api/v1','https://api.mistral.ai/v1'].every(x=>html.includes(x)));
console.log(`\n結果：${pass} 通過 / ${fail} 失敗\n`);
process.exit(fail?1:0);
