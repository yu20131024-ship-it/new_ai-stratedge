// POST /.netlify/functions/delete-download
// body: { id: "<event id>" }
// 讓管理者可以刪除某一筆下載紀錄裡「儲存的檔案本體」。刪除後：
// ① Netlify Blobs 裡的實際檔案內容會被移除（真的刪掉，不是隱藏）；
// ② 對應的事件紀錄會保留（登入者、時間、檔名等中繼資訊不會消失，方便稽核「曾經下載過什麼」），
//    但 fileId 會被清空並補上刪除時間／刪除者，讓管理後台顯示「無檔案」。
// 這樣設計的理由：完全刪掉整筆紀錄會讓「誰在什麼時候下載過什麼」這個稽核軌跡也一併消失，
// 通常管理者要刪的是「檔案內容本身」（例如檔案太大、或內容過時想清掉），而不是想抹去
// 曾經發生過下載這件事的事實。

const { getIdentityUser, isAdmin, getLogsStore, getFilesStore, updateLogsWithRetry, json } = require('./_utils');

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
    // 先做一次性讀取來驗證輸入（紀錄是否存在、是否還有檔案可刪），維持原本「輸入錯誤時
    // 快速回應 404/400」的使用者體驗，不需要為了防呆而讓明顯錯誤的請求也跑重試迴圈。
    const logsStore = getLogsStore(event);
    const existing = await logsStore.get('all-events', { type: 'json' });
    const all = Array.isArray(existing) ? existing : [];
    const record = all.find(ev => ev.id === id);
    if (!record) {
      return json(404, { error: 'not_found', message: '找不到這筆紀錄' });
    }
    if (!record.fileId) {
      return json(400, { error: 'no_file', message: '這筆紀錄本來就沒有檔案可刪除' });
    }

    const fileIdToDelete = record.fileId;
    const filesStore = getFilesStore(event);
    await filesStore.delete(fileIdToDelete);

    // v2.3.26 變更：索引陣列的更新改走 updateLogsWithRetry（樂觀鎖＋自動重試），
    // 避免這裡的整包寫回把「同一瞬間發生的其他請求」（例如使用者正在下載新報告、
    // 或另一個管理者同時在刪別筆紀錄）剛寫入的結果覆蓋掉。mutateFn 每次重試都會
    // 重新從最新資料裡尋找這筆紀錄，而不是沿用最一開始讀到的舊版本，這樣即使中間
    // 陣列已經被別的請求動過，也一定是在「當下最新版本」上做修改。
    //
    // 極端情況防呆：如果重試期間發現這筆紀錄的 fileId 已經被別的請求清空（代表另一個
    // 幾乎同時送出的刪除請求搶先完成了同一件事），代表「檔案已被刪除」這個目標其實已經
    // 達成，直接視為成功、不重複寫入也不當成錯誤丟出，避免使用者對同一筆紀錄快速點兩次
    // 「刪除」時收到令人困惑的伺服器錯誤。
    await updateLogsWithRetry(event, (freshAll) => {
      const freshRecord = freshAll.find(ev => ev.id === id);
      if (!freshRecord) {
        const err = new Error('這筆紀錄在處理過程中被移除，請重新整理後再確認');
        err.code = 'not_found';
        throw err;
      }
      if (!freshRecord.fileId) {
        // 已經被同時發生的另一個請求清空，視為目標已達成，直接回傳不變的陣列即可。
        return freshAll;
      }
      freshRecord.fileDeleted = true;
      freshRecord.fileDeletedAt = new Date().toISOString();
      freshRecord.fileDeletedBy = user.email;
      delete freshRecord.fileId;
      return freshAll;
    });

    return json(200, { ok: true, id });
  } catch (e) {
    if (e && e.code === 'not_found') {
      return json(404, { error: 'not_found', message: e.message });
    }
    return json(500, { error: 'internal_error', message: e && e.message });
  }
};
