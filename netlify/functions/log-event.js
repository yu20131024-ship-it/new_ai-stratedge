// POST /.netlify/functions/log-event
// 前端在兩個時機呼叫這支：① 使用者登入成功後（type: 'login'）；
// ② 使用者按下任何下載按鈕之後（type: 'download'，並附上檔案內容）。
//
// 安全性重點：這支 function 完全不相信前端傳來的「使用者是誰」，
// 一律以 Netlify Identity 驗證過的 context.clientContext.user 為準
// （前端傳 Authorization: Bearer <token>，Netlify 驗證通過才會有這個物件）。
// 這樣即使有人竄改前端 JS 冒充別人的名字，記錄裡仍然是真正登入者的帳號。

const { randomUUID } = require('crypto');
const { getIdentityUser, getClientIp, getUserAgent, getLogsStore, getFilesStore, json } = require('./_utils');

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const user = getIdentityUser(context);
  if (!user) {
    // 沒有合法登入憑證，一律拒絕記錄（也代表前端登入關卡如果被繞過，這裡仍然擋得住）。
    return json(401, { error: 'not_authenticated' });
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

  const record = {
    id: randomUUID(),
    type,
    email: user.email,
    // Google 登入時，Netlify Identity 會把 Google 帳號的顯示名稱放在 user_metadata.full_name，
    // 這裡優先取這個當作「中文姓名」欄位；沒有的話退回 email 前半段。
    name: (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || user.email.split('@')[0],
    ip: getClientIp(event),
    userAgent: getUserAgent(event),
    time: new Date().toISOString()
  };

  if (type === 'download') {
    record.reportName = String(payload.reportName || '未命名檔案').slice(0, 200);
    record.reportFormat = String(payload.reportFormat || '').slice(0, 50);
    // 檔案內容（前端會傳 base64 或純文字），存進獨立的 Blobs store，
    // 事件紀錄本身只存一個 fileId 指標，避免登入紀錄列表因為夾帶大檔案而變得又大又慢。
    if (payload.fileContent) {
      const filesStore = getFilesStore();
      const fileId = record.id;
      await filesStore.set(fileId, payload.fileContent, {
        metadata: {
          filename: record.reportName,
          contentType: payload.contentType || 'text/html;charset=utf-8',
          uploadedBy: user.email,
          uploadedAt: record.time
        }
      });
      record.fileId = fileId;
    }
  }

  const logsStore = getLogsStore();
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
};
