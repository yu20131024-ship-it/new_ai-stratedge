// 共用工具：所有 functions 都會用到的身份驗證與 Blobs 存取邏輯集中在這裡，
// 避免三個 function 各寫一份、日後管理者 email 要改的時候到處漏改。

const { getStore } = require('@netlify/blobs');

// 唯一可以看管理後台的帳號。要換管理者，只需要改這一行。
const ADMIN_EMAIL = 'felix670131@gmail.com';

// 從 Netlify Identity 自動附加的 clientContext 讀出目前登入的使用者。
// 這個物件的存在，代表請求的 Authorization: Bearer <token> 已經被 Netlify
// 驗證過是「合法、未過期」的 Identity JWT——偽造或篡改的 token 根本不會進到這裡，
// 所以後面的權限判斷是可信的伺服器端驗證，不是前端隨便寫寫可以繞過的檢查。
function getIdentityUser(context) {
  return (context && context.clientContext && context.clientContext.user) || null;
}

function isAdmin(user) {
  return !!(user && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
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
function getLogsStore() {
  return getStore('strat-edge-logs');
}
function getFilesStore() {
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
