// 共用工具：所有 functions 都會用到的身份驗證與 Blobs 存取邏輯集中在這裡，
// 避免三個 function 各寫一份、日後管理者 email 要改的時候到處漏改。

const { getStore, connectLambda } = require('@netlify/blobs');

// 唯一可以看管理後台的帳號。要換管理者，只需要改這一行。
const ADMIN_EMAIL = 'felix670131@gmail.com';

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
  return !!(user && user.email && user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase());
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

function json(statusCode, bodyObj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(bodyObj)
  };
}

module.exports = { ADMIN_EMAIL, getIdentityUser, isAdmin, getClientIp, getUserAgent, getLogsStore, getFilesStore, json };
