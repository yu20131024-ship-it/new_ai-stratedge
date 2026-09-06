// POST /.netlify/functions/delete-download
// body: { id: "<event id>" }
// 讓管理者可以刪除某一筆下載紀錄裡「儲存的檔案本體」。刪除後：
// ① Netlify Blobs 裡的實際檔案內容會被移除（真的刪掉，不是隱藏）；
// ② 對應的事件紀錄會保留（登入者、時間、檔名等中繼資訊不會消失，方便稽核「曾經下載過什麼」），
//    但 fileId 會被清空並補上刪除時間／刪除者，讓管理後台顯示「無檔案」。
// 這樣設計的理由：完全刪掉整筆紀錄會讓「誰在什麼時候下載過什麼」這個稽核軌跡也一併消失，
// 通常管理者要刪的是「檔案內容本身」（例如檔案太大、或內容過時想清掉），而不是想抹去
// 曾經發生過下載這件事的事實。

const { getIdentityUser, isAdmin, getLogsStore, getFilesStore, json } = require('./_utils');

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const user = getIdentityUser(context);
  if (!user) {
    return json(401, { error: 'not_authenticated' });
  }
  if (!isAdmin(user)) {
    return json(403, { error: 'forbidden', message: '此帳號沒有刪除檔案的權限' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'invalid_json' });
  }
  const id = payload.id;
  if (!id) {
    return json(400, { error: 'missing_id' });
  }

  try {
    const logsStore = getLogsStore(event);
    let all = [];
    try {
      const existing = await logsStore.get('all-events', { type: 'json' });
      if (Array.isArray(existing)) all = existing;
    } catch (e) {
      // 尚無資料
    }

    const record = all.find(ev => ev.id === id);
    if (!record) {
      return json(404, { error: 'not_found', message: '找不到這筆紀錄' });
    }
    if (!record.fileId) {
      return json(400, { error: 'no_file', message: '這筆紀錄本來就沒有檔案可刪除' });
    }

    const filesStore = getFilesStore(event);
    await filesStore.delete(record.fileId);

    // 保留事件紀錄本身，只清空 fileId 並補上刪除軌跡
    record.fileDeleted = true;
    record.fileDeletedAt = new Date().toISOString();
    record.fileDeletedBy = user.email;
    delete record.fileId;

    await logsStore.setJSON('all-events', all);

    return json(200, { ok: true, id });
  } catch (e) {
    return json(500, { error: 'internal_error', message: e && e.message });
  }
};
