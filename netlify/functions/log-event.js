// POST /.netlify/functions/log-event
// 前端在兩個時機呼叫這支：① 使用者登入成功後（type: 'login'）；
// ② 使用者按下任何下載按鈕之後（type: 'download'，並附上檔案內容）。
//
// 安全性重點：這支 function 完全不相信前端傳來的「使用者是誰」，
// 一律以 Netlify Identity 驗證過的 context.clientContext.user 為準
// （前端傳 Authorization: Bearer <token>，Netlify 驗證通過才會有這個物件）。
// 這樣即使有人竄改前端 JS 冒充別人的名字，記錄裡仍然是真正登入者的帳號。
//
// v2.3.24 變更：'login' 事件維持「一定要有合法登入身份才記錄」——沒登入哪來的
// 「誰登入了」可以記。但 'download' 事件改成「有登入就記錄真實身份，沒有合法登入
// 身份（包含前端登入關卡被繞過的情況，例如用瀏覽器開發者工具關掉遮罩、或直接呼叫
// 產生報告的 JS 函式）一樣要記錄，只是身份標記為「未登入」」。這是因為「產生報告」
// 這個動作本身完全在前端瀏覽器裡就能獨立完成、不需要呼叫任何有身份驗證的 API，
// 所以只要求「呼叫這支 API 時必須帶有效登入憑證」，擋不住繞過畫面登入關卡的人
// 下載報告本身，只會讓這種下載「不會被記錄」。開放 'download' 事件可以匿名呼叫
// 之後，不管有沒有登入，只要走過前端下載流程，這支 function 都會被呼叫、檔案都
// 會被存下來，管理後台才會真的一份不漏。
// 唯一還是抓不到的情況：使用者連呼叫這支 API（前端的 __logEvent）這行程式碼本身
// 都手動移除或覆寫掉再執行下載——這已經是刻意規避追蹤，不是「順手繞過」，任何純
// 前端記錄機制都無法防範這種情況，只有把「產生報告」的核心邏輯整個搬到後端才能根治。

const { randomUUID } = require('crypto');
const { getIdentityUser, getClientIp, getUserAgent, getLogsStore, getFilesStore, json } = require('./_utils');

// 匿名（未登入）下載請求的檔案內容大小上限，避免這支現在開放給任何人呼叫的 API
// 被拿來塞爆 Blobs 儲存空間。已登入的請求不受此限制（沿用原本行為）。
const ANONYMOUS_FILE_CONTENT_MAX_BYTES = 6 * 1024 * 1024; // 6MB

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'invalid_json' });
  }

  const { type } = payload; // 'login' | 'download'
  if (type !== 'login' && type !== 'download') {
    return json(400, { error: 'invalid_type' });
  }

  const user = getIdentityUser(context);

  // 'login' 事件仍然一定要求合法登入身份；'download' 事件則兩種情況都放行，
  // 差別只在於記錄裡的身份是「真實帳號」還是「未登入」。
  if (type === 'login' && !user) {
    return json(401, { error: 'not_authenticated' });
  }

  const isAnonymous = !user;

  if (isAnonymous && payload.fileContent && String(payload.fileContent).length > ANONYMOUS_FILE_CONTENT_MAX_BYTES) {
    return json(413, { error: 'payload_too_large', message: '未登入狀態下傳送的檔案內容過大' });
  }

  const record = {
    id: randomUUID(),
    type,
    email: user ? user.email : null,
    // Google 登入時，Netlify Identity 會把 Google 帳號的顯示名稱放在 user_metadata.full_name，
    // 這裡優先取這個當作「中文姓名」欄位；沒有的話退回 email 前半段。
    // 未登入（含繞過前端登入關卡）的情況沒有任何身份資訊可用，一律標記為固定文字，
    // 讓管理者在後台一眼就能分辨這筆紀錄「無法追蹤到實際帳號」。
    name: user
      ? ((user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || user.email.split('@')[0])
      : '（未登入使用者）',
    isAnonymous,
    ip: getClientIp(event),
    userAgent: getUserAgent(event),
    time: new Date().toISOString()
  };

  try {
    if (type === 'download') {
      record.reportName = String(payload.reportName || '未命名檔案').slice(0, 200);
      record.reportFormat = String(payload.reportFormat || '').slice(0, 50);
      // 檔案內容（前端會傳 base64 或純文字），存進獨立的 Blobs store，
      // 事件紀錄本身只存一個 fileId 指標，避免登入紀錄列表因為夾帶大檔案而變得又大又慢。
      if (payload.fileContent) {
        const filesStore = getFilesStore(event);
        const fileId = record.id;
        await filesStore.set(fileId, payload.fileContent, {
          metadata: {
            filename: record.reportName,
            contentType: payload.contentType || 'text/html;charset=utf-8',
            uploadedBy: user ? user.email : '（未登入使用者）',
            uploadedAt: record.time
          }
        });
        record.fileId = fileId;
      }
    }

    const logsStore = getLogsStore(event);
    // 用「單一 key 存整個陣列」的方式，符合 Netlify Blobs 建議的存取模式
    // （避免用大量小 key 造成之後 list 效能不佳）；筆數不多（公司內部使用工具），直接整包讀寫即可。
    let all = [];
    try {
      const existing = await logsStore.get('all-events', { type: 'json' });
      if (Array.isArray(existing)) all = existing;
    } catch (e) {
      // 第一次使用、還沒有任何資料時會走到這裡，維持空陣列即可。
    }
    all.push(record);
    // 最多保留 5000 筆，避免無限成長；超過時砍掉最舊的。
    if (all.length > 5000) all = all.slice(all.length - 5000);
    await logsStore.setJSON('all-events', all);

    return json(200, { ok: true, id: record.id });
  } catch (e) {
    // v2.3.19：這支原本是前端「fire-and-forget」呼叫（見 index.html 的 .catch 只 console.warn），
    // 所以就算之前 Blobs 環境設定有問題、這裡一樣在丟 502，使用者完全不會看到——
    // 只是登入/下載紀錄悄悄地沒被記下來。加上 try/catch 回傳明確錯誤，方便從 Netlify
    // functions log 看到，而不是無聲失敗。
    return json(500, { error: 'internal_error', message: e && e.message });
  }
};
