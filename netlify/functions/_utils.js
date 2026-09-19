// 共用工具：所有 functions 都會用到的身份驗證與 Blobs 存取邏輯集中在這裡，
// 避免三個 function 各寫一份、日後管理者 email 要改的時候到處漏改。

const { getStore, connectLambda } = require('@netlify/blobs');

// 唯一可以看管理後台的帳號。要換管理者，只需要改這一行。
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim();

// v2.3.19 修復「查詢失敗（狀態碼 502）」：
// 這幾支 function 都用 exports.handler = async function(event, context) 這種舊式
// （Netlify 所謂 Lambda 相容模式）寫法，目的是讀取 Netlify Identity 附加在
// context.clientContext.user 的登入資訊。但 Netlify Blobs 的 getStore() 只有在
// 「新式」function 執行環境下才會自動讀到 siteID / token 等設定；在 Lambda 相容模式下
// 完全不會自動配置，直接呼叫 getStore() 會丟出 MissingBlobsEnvironmentError。
// 這個例外先前沒有被任何 try/catch 接住，Netlify 平台就直接回傳 502（不是我們自訂的
// 錯誤訊息，是整支 function 執行到一半掛掉的訊號）——這就是管理後台「查詢失敗
// （狀態碼 502）」的根本原因。
// 官方作法：呼叫 getStore() 之前，先用當次請求的 event 呼叫一次 connectLambda(event)，
// 手動把環境配置好。集中寫在這裡，四支 function 都呼叫 getLogsStore(event) /
// getFilesStore(event)（記得帶入 event），之後任何 function 要用到 Blobs 也不會忘記做這一步。
function ensureBlobsEnv(event) {
  connectLambda(event);
}

// 從 Netlify Identity 自動附加的 clientContext 讀出目前登入的使用者。
// 這個物件的存在，代表請求的 Authorization: Bearer <token> 已經被 Netlify
// 驗證過是「合法、未過期」的 Identity JWT——偽造或篡改的 token 根本不會進到這裡，
// 所以後面的權限判斷是可信的伺服器端驗證，不是前端隨便寫寫可以繞過的檢查。
function getIdentityUser(context) {
  return (context && context.clientContext && context.clientContext.user) || null;
}

function isAdmin(user) {
  return !!(ADMIN_EMAIL && user && user.email && user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase());
}

function getClientIp(event) {
  const xff = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
  if (xff) return xff.split(',')[0].trim();
  return event.headers['x-nf-client-connection-ip'] || event.headers['X-Nf-Client-Connection-Ip'] || 'unknown';
}

function getUserAgent(event) {
  return event.headers['user-agent'] || event.headers['User-Agent'] || 'unknown';
}

// 兩個 Blobs 儲存區：一個放「登入／下載事件的紀錄」（小筆 JSON，查詢用），
// 一個放「下載當下產生的檔案本體」（可能較大，只有點擊下載連結時才讀取）。
function getLogsStore(event) {
  ensureBlobsEnv(event);
  return getStore('strat-edge-logs');
}
function getFilesStore(event) {
  ensureBlobsEnv(event);
  return getStore('strat-edge-files');
}

// v2.3.26 新增：修正「多個請求同時寫入同一份紀錄陣列」的競態條件（race condition）。
//
// 問題背景：log-event.js（每次登入/下載都會呼叫）與 delete-download.js（管理者刪檔）
// 原本都是「整包讀出 all-events 陣列 → 在記憶體裡改 → 整包寫回」。如果兩個請求幾乎
// 同時執行（例如使用者甲正在下載報告的同一瞬間，管理者乙正在刪除另一筆舊紀錄的檔案），
// 兩邊各自讀到「舊版」陣列、各自修改、最後誰的 setJSON 晚一點點執行，就會用「舊版+自己的
// 修改」整個覆蓋掉對方剛寫入的結果——對方那筆紀錄就這樣悄悄消失，且不會有任何錯誤訊息，
// 事後也無法察覺是哪次遺失的。這是稽核紀錄系統最不能接受的一種 bug（沉默的資料遺失）。
//
// 修法：改用 Netlify Blobs 10.0.0 起支援的「條件式寫入」（optimistic concurrency /
// 樂觀鎖）：讀取時一併拿到當下版本的 etag；寫入時帶上 { onlyIfMatch: etag }，如果寫入
// 當下 etag 已經被別人改變（代表期間有別的請求搶先寫入了），Blobs 會拒絕這次寫入並回傳
// { modified:false }，而不是直接覆蓋——這裡收到 modified:false 後，會重新讀取「別人剛寫
// 入的最新版本」，把自己這次的修改重新套用一次再寫入，最多重試 maxRetries 次。這樣不管
// 兩個請求誰先誰後、間隔多短，兩邊的修改最終都保證會存在，不會有任何一筆被默默蓋掉。
// 第一次寫入（key 還不存在、沒有 etag 可比對）則用 { onlyIfNew:true }，確保就算兩個「第一
// 筆事件」同時發生，也只有一個會真的建立這個 key，另一個會被拒絕、重讀後改用一般的
// onlyIfMatch 流程補上自己的資料，邏輯上與「已存在資料」的情況完全一致，不需要另外特判。
//
// mutateFn(currentArray) 的兩種合法回傳方式：
//   ① 直接在傳入的陣列上 push/修改後 return 該陣列
//   ② 回傳一個新陣列
// mutateFn 若因為「業務邏輯本身有問題」（例如刪除一筆不存在的紀錄）而丟出例外，
// 這個例外會直接往外傳、不會被當成「需要重試的衝突」──重試解決不了「這筆紀錄本來就不存在」
// 這種問題，讓它立刻回到呼叫端統一轉成對應的 HTTP 錯誤（404/400），這點在
// delete-download.js 的自動化測試中有覆蓋到。
async function updateLogsWithRetry(event, mutateFn, { maxRetries = 12 } = {}) {
  const logsStore = getLogsStore(event);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let all = [];
    let etag;
    const existing = await logsStore.getWithMetadata('all-events', { type: 'json', consistency: 'strong' });
    if (existing && Array.isArray(existing.data)) {
      all = existing.data;
      etag = existing.etag;
    }

    // mutateFn 可能修改傳入陣列或回傳新陣列；也可能因為業務邏輯錯誤直接丟出例外，
    // 這裡刻意不包 try/catch，讓例外原樣往外拋給呼叫端處理。
    let nextAll = mutateFn(all);
    if (!Array.isArray(nextAll)) nextAll = all;

    // 最多保留 5000 筆，避免無限成長；超過時砍掉最舊的（沿用原本既有規則，行為不變）。
    if (nextAll.length > 5000) nextAll = nextAll.slice(nextAll.length - 5000);

    const writeOptions = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
    const result = await logsStore.setJSON('all-events', nextAll, writeOptions);

    if (result && result.modified === false) {
      // 期間有其他請求搶先寫入了新版本，重新讀取最新資料、重新套用這次的修改再試一次。
      if (attempt === maxRetries) {
        const err = new Error('寫入衝突次數過多，請稍後再試一次');
        err.code = 'conflict_retry_exhausted';
        throw err;
      }
      // 加入「指數退避＋隨機抖動」再重試，而不是立刻無延遲重試：如果一大群請求幾乎
      // 同時衝突，全部立刻重試只會讓它們在下一輪又同時撞在一起（類似網路上說的
      // 「thundering herd」現象）；每次重試前錯開一點隨機時間，能大幅提高短時間內
      // 大量併發請求最終都成功寫入的機率，而不需要把重試上限設得不切實際地高。
      const backoffMs = Math.min(300, 20 * Math.pow(1.6, attempt)) + Math.random() * 30;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      continue;
    }
    return nextAll;
  }
}

function json(statusCode, bodyObj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(bodyObj)
  };
}

module.exports = { ADMIN_EMAIL, getIdentityUser, isAdmin, getClientIp, getUserAgent, getLogsStore, getFilesStore, updateLogsWithRetry, json };
