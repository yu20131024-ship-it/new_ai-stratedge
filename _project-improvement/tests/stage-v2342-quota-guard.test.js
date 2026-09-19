/* v2.3.45：Agnes 合規配額守門測試
 * 直接擷取 index.html 真實 AgnesQuotaGuard 原始碼，驗證：
 * ① RPM <15、RPD <30、TPM <10000
 * ② 單次請求超過 TPM 時不送 API
 * ③ 每次 retry attempt 都先 acquire（不可繞過）
 * ④ 每日額度到 29 後停止
 */
const { readIndex, extractDeclaration } = require('./lib/extract.js');
const html = readIndex();
let pass=0, fail=0;
function check(name, ok, detail){
  if(ok){pass++;console.log('  ✅ '+name+(detail?'　'+detail:''));}
  else{fail++;console.log('  ❌ '+name+(detail?'　'+detail:''));}
}
console.log('\n=== v2.3.45：Agnes 合規配額守門 ===\n');

const rpm=Number((html.match(/const AGNES_RPM_LIMIT\s*=\s*(\d+)/)||[])[1]);
const rpd=Number((html.match(/const AGNES_RPD_LIMIT\s*=\s*(\d+)/)||[])[1]);
const tpm=Number((html.match(/const AGNES_TPM_LIMIT\s*=\s*(\d+)/)||[])[1]);
check('RPM 安全上限嚴格小於 15', rpm<15 && rpm>0, String(rpm));
check('RPD 安全上限嚴格小於 30', rpd<30 && rpd>0, String(rpd));
check('TPM 安全上限嚴格小於 10,000', tpm<10000 && tpm>0, String(tpm));

const doFetchSrc=extractDeclaration(html, '  const doFetch=async(signal)=>{');
check('callAgnes 的每一次 doFetch attempt 都先呼叫 AgnesQuotaGuard.acquire',
  /await AgnesQuotaGuard\.acquire\(inputTokens \+ effectiveMaxTokens, signal\);/.test(doFetchSrc));
check('輸出 max_tokens 先依剩餘 TPM 動態縮小，再交給 quota guard',
  /const effectiveMaxTokens = Math\.min\(requestedMaxTokens, remainingTpm\);/.test(doFetchSrc) && /inputTokens \+ effectiveMaxTokens/.test(doFetchSrc));

const guardSrc=extractDeclaration(html, 'const AgnesQuotaGuard = {');
const loadSrc=extractDeclaration(html, 'function loadAgnesQuota(){');
const saveSrc=extractDeclaration(html, 'function saveAgnesQuota(state){');
const waitSrc=extractDeclaration(html, 'function quotaWaitMs(list, now){');

function makeStorage(){
  const map=new Map();
  return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
}
const RealDate=Date;
let now=Date.UTC(2026,8,19,0,0,0);
function FakeDate(...args){ return args.length?new RealDate(...args):new RealDate(now); }
FakeDate.now=()=>now;
FakeDate.UTC=RealDate.UTC; FakeDate.parse=RealDate.parse;
const storage=makeStorage();
const fakeWindow={_onAiRetry(){},};
const fakeDiag={status:''};
fakeWindow.__aiDiag=fakeDiag;
const waits=[]; const fakeSetTimeout=(fn,ms)=>{ waits.push(ms); now+=ms; fn(); return 1; };

const src = `
${loadSrc}
${saveSrc}
${waitSrc}
const AGNES_RPM_LIMIT=${rpm};
const AGNES_RPD_LIMIT=${rpd};
const AGNES_TPM_LIMIT=${tpm};
const AGNES_QUOTA_KEY='test';
const AGNES_QUOTA_WINDOW_MS=60000;
${guardSrc}
return AgnesQuotaGuard;`;

const Guard = new Function('Date','localStorage','window','setTimeout',src)(FakeDate,storage,fakeWindow,fakeSetTimeout);

(async()=>{
  // oversized single request must fail without reservation
  let threw=false;
  try{ await Guard.acquire(tpm+1,null); }catch(e){ threw=e.code==='agnes_tpm_request_too_large'; }
  const st1=JSON.parse(storage.getItem('test')||'{"requests":[],"tokens":[],"dailyRequests":[]}');
  check('單一請求預估超過 9,999 tokens 時直接拒絕、不預留配額',threw && st1.dailyRequests.length===0);

  // 29 reservations, 30th rejected
  for(let i=0;i<rpd;i++) await Guard.acquire(100,null);
  let dailyBlocked=false;
  try{ await Guard.acquire(100,null); }catch(e){ dailyBlocked=e.code==='agnes_rpd_exhausted'; }
  const st2=JSON.parse(storage.getItem('test'));
  check('累積 29 次後，第 30 次不再送出',dailyBlocked && st2.dailyRequests.length===29, 'daily='+st2.dailyRequests.length);

  // RPM and TPM tests use a fresh storage and new guard instance
  const storage2=makeStorage();
  const Guard2=new Function('Date','localStorage','window','setTimeout',src)(FakeDate,storage2,fakeWindow,fakeSetTimeout);
  // one request with 1000 tokens, then 14th should be present; 15th waits until expiry
  for(let i=0;i<rpm;i++) await Guard2.acquire(500,null);
  const before=JSON.parse(storage2.getItem('test'));
  check('14 次請求可被記錄於 60 秒窗口',before.requests.length===14 && before.requests.length<15);
  await Guard2.acquire(500,null);
  const after=JSON.parse(storage2.getItem('test'));
  check('第 15 次會先等待舊請求釋放，而不是在同一窗口直接送出',waits.some(ms=>ms>=60000) && after.dailyRequests.length===15,'等待='+JSON.stringify(waits));

  // TPM: 9k then 1k requires wait
  const storage3=makeStorage();
  const Guard3=new Function('Date','localStorage','window','setTimeout',src)(FakeDate,storage3,fakeWindow,fakeSetTimeout);
  await Guard3.acquire(9000,null);
  await Guard3.acquire(999,null);
  const beforeT=JSON.parse(storage3.getItem('test'));
  check('TPM 累積保持在 9,999 以內',beforeT.tokens.reduce((n,x)=>n+x.tokens,0)===9999);
  console.log('\n結果：'+pass+' 通過 / '+fail+' 失敗\n');
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
