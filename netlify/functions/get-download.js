// GET /.netlify/functions/get-download?id=<fileId>
// 讓管理者可以把「使用者當初下載過的那一份報告」原封不動再下載一次。
// 一樣是伺服器端驗證管理者身份，非管理者一律 403，不會因為知道 fileId 就能繞過。

const { getIdentityUser, isAdmin, getLogsStore, getFilesStore, json } = require('./_utils');

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'method_not_allowed' });
  }

  const user = getIdentityUser(context);
  if (!user) {
    return json(401, { error: 'not_authenticated' });
  }
  if (!isAdmin(user)) {
    return json(403, { error: 'forbidden', message: '此帳號沒有下載他人報告的權限' });
  }

  const fileId = event.queryStringParameters && event.queryStringParameters.id;
  if (!fileId) {
    return json(400, { error: 'missing_id' });
  }

  const filesStore = getFilesStore();
  const fileContent = await filesStore.get(fileId, { type: 'text' });
  if (fileContent == null) {
    return json(404, { error: 'not_found', message: '找不到這筆檔案，可能已被清除或 ID 錯誤' });
  }
  const meta = await filesStore.getMetadata(fileId);
  const filename = (meta && meta.metadata && meta.metadata.filename) || (fileId + '.html');
  const contentType = (meta && meta.metadata && meta.metadata.contentType) || 'text/html;charset=utf-8';

  return {
    statusCode: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': 'attachment; filename="' + encodeURIComponent(filename) + '"'
    },
    body: fileContent
  };
};
