// GET /.netlify/functions/admin-logs
// 回傳全部使用者的登入／下載紀錄。這支是整個系統唯一「敏感資料出口」，
// 權限判斷完全在伺服器端進行：呼叫者的 email 必須通過 Netlify Identity 驗證，
// 且等於 ADMIN_EMAIL，否則一律 403。前端要不要顯示「管理後台」按鈕只是體驗優化，
// 就算有人直接打這支 API 網址，沒有正確身份一樣拿不到資料。

const { getIdentityUser, isAdmin, getLogsStore, json } = require('./_utils');

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'method_not_allowed' });
  }

  const user = getIdentityUser(context);
  if (!user) {
    return json(401, { error: 'not_authenticated' });
  }
  if (!isAdmin(user)) {
    return json(403, { error: 'forbidden', message: '此帳號沒有管理後台的查看權限' });
  }

  try {
    const logsStore = getLogsStore(event);
    let all = [];
    try {
      const existing = await logsStore.get('all-events', { type: 'json' });
      if (Array.isArray(existing)) all = existing;
    } catch (e) {
      // 尚無任何資料
    }

    // 依時間新到舊排序，管理者最想先看到最近發生的事
    all.sort((a, b) => new Date(b.time) - new Date(a.time));

    return json(200, { ok: true, count: all.length, events: all });
  } catch (e) {
    // v2.3.19：任何未預期例外（例如 Blobs 環境設定問題）都回傳明確的 JSON 錯誤，
    // 而不是讓 Netlify 直接吐出裸的 502，方便日後排查。
    return json(500, { error: 'internal_error', message: e && e.message });
  }
};
