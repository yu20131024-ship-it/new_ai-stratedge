// _project-improvement/tests/stage2-concurrency.test.js
//
// 階段2自動化測試：驗證 log-event.js／delete-download.js 修改後，
// 「多個請求幾乎同時寫入同一份 all-events 陣列」不會再遺失資料。
//
// 這支測試「不需要」真的連到 Netlify 的伺服器或帳號——它會暫時在
// netlify/functions/node_modules/@netlify/blobs/ 底下放一份模擬版的
// @netlify/blobs 套件（完全依照官方型別定義中記載的 onlyIfMatch／onlyIfNew／
// modified 這幾個欄位的行為來實作，並刻意加入隨機延遲來模擬真實網路情境下
// 「兩個請求的讀取/寫入時間點會交錯」的狀況），跑完之後會自動清掉這個暫時性
// 資料夾，不會留在專案裡、也不會被一起打包上傳。
//
// 用法：直接執行 `node _project-improvement/tests/stage2-concurrency.test.js`
// （不需要 npm install，只需要 Node.js）。全部通過會印出「✅ 全部通過」並以
// exit code 0 結束；任何一項失敗都會印出詳細原因並以非 0 結束，方便未來任何
// 階段的修改都可以重新跑一次這支測試做回歸驗證。

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const FUNCTIONS_DIR = path.join(__dirname, '..', '..', 'netlify', 'functions');
const MOCK_MODULE_DIR = path.join(FUNCTIONS_DIR, 'node_modules', '@netlify', 'blobs');

// ---------- 1. 建立暫時性的 @netlify/blobs 模擬模組 ----------

const MOCK_PACKAGE_JSON = JSON.stringify({ name: '@netlify/blobs', version: '0.0.0-test-mock', main: 'index.js' }, null, 2);

// 模擬實作依據：npm 套件 @netlify/blobs 10.x 之 dist/main.d.ts 內對
// SetOptions / WriteResult / GetWithMetadataOptions 的官方型別定義（onlyIfMatch
// 比對現有 etag、onlyIfNew 要求 key 不存在、寫入結果回傳 { modified, etag }）。
const MOCK_MODULE_CODE = `
// ==== 測試專用模擬模組，僅供 stage2-concurrency.test.js 執行期間暫時存在 ====
const stores = new Map(); // storeName -> Map(key -> { value, etag, metadata })
let etagCounter = 0;
function nextEtag() { etagCounter += 1; return 'etag-' + etagCounter; }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomJitter() { return delay(Math.floor(Math.random() * 12)); } // 模擬真實網路延遲交錯

function getStoreBacking(name) {
  if (!stores.has(name)) stores.set(name, new Map());
  return stores.get(name);
}

class MockStore {
  constructor(name) { this._name = name; }

  async get(key, opts) {
    await randomJitter();
    const backing = getStoreBacking(this._name);
    const entry = backing.get(key);
    if (!entry) return null;
    if (opts && opts.type === 'json') return JSON.parse(entry.value);
    return entry.value;
  }

  async getWithMetadata(key, opts) {
    await randomJitter();
    const backing = getStoreBacking(this._name);
    const entry = backing.get(key);
    if (!entry) return null;
    const data = (opts && opts.type === 'json') ? JSON.parse(entry.value) : entry.value;
    return { data, etag: entry.etag, metadata: entry.metadata || {} };
  }

  async set(key, data, opts) {
    return this._write(key, typeof data === 'string' ? data : JSON.stringify(data), opts);
  }

  async setJSON(key, data, opts) {
    return this._write(key, JSON.stringify(data), opts);
  }

  async _write(key, serialized, opts) {
    await randomJitter();
    const backing = getStoreBacking(this._name);
    const current = backing.get(key);
    opts = opts || {};

    if (opts.onlyIfNew) {
      if (current) return { modified: false };
    } else if (opts.onlyIfMatch) {
      if (!current || current.etag !== opts.onlyIfMatch) return { modified: false };
    }

    const etag = nextEtag();
    backing.set(key, { value: serialized, etag, metadata: (opts.metadata || (current && current.metadata)) });
    return { modified: true, etag };
  }

  async delete(key) {
    await randomJitter();
    getStoreBacking(this._name).delete(key);
  }
}

function getStore(name) { return new MockStore(name); }
function connectLambda() { /* 測試環境不需要真的接 Lambda context，no-op */ }

module.exports = { getStore, connectLambda, __mock__: { stores, getStoreBacking, MockStore } };
`;

function installMockModule() {
  fs.mkdirSync(MOCK_MODULE_DIR, { recursive: true });
  fs.writeFileSync(path.join(MOCK_MODULE_DIR, 'package.json'), MOCK_PACKAGE_JSON, 'utf-8');
  fs.writeFileSync(path.join(MOCK_MODULE_DIR, 'index.js'), MOCK_MODULE_CODE, 'utf-8');
}

function uninstallMockModule() {
  const root = path.join(FUNCTIONS_DIR, 'node_modules');
  if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
}

function freshRequire(modulePath, resolveFromPaths) {
  const resolved = resolveFromPaths
    ? require.resolve(modulePath, { paths: resolveFromPaths })
    : require.resolve(modulePath);
  delete require.cache[resolved];
  return require(resolved);
}

// ---------- 2. 測試用的假 event / context ----------

function fakeEvent(body) {
  return {
    httpMethod: 'POST',
    headers: { 'user-agent': 'stage2-test', 'x-forwarded-for': '127.0.0.1' },
    body: JSON.stringify(body)
  };
}

function fakeAdminContext() {
  return { clientContext: { user: { email: 'felix670131@gmail.com', user_metadata: { full_name: '測試管理者' } } } };
}

function fakeAnonymousContext() {
  return {};
}

// ---------- 3. 測試案例 ----------

const results = [];
function record(name, fn) {
  results.push({ name, fn });
}

record('50 個匿名下載事件同時送出，不可遺失任何一筆', async ({ logEvent, blobs }) => {
  const calls = [];
  for (let i = 0; i < 50; i++) {
    calls.push(logEvent.handler(fakeEvent({ type: 'download', reportName: 'report-' + i }), fakeAnonymousContext()));
  }
  const responses = await Promise.all(calls);
  responses.forEach(r => assert.strictEqual(r.statusCode, 200, '每一次呼叫都應該成功回傳200'));

  const logsStore = blobs.getStore('strat-edge-logs');
  const all = await logsStore.get('all-events', { type: 'json' });
  assert.strictEqual(all.length, 50, `應該有50筆紀錄，實際只有 ${all.length} 筆（代表有紀錄在併發寫入時遺失）`);
  const uniqueIds = new Set(all.map(r => r.id));
  assert.strictEqual(uniqueIds.size, 50, '不應該有重複或遺失的id');
});

record('下載事件與刪除既有檔案同時發生，兩邊的結果都要保留', async ({ logEvent, deleteDownload, blobs }) => {
  // 先種入20筆「已存在、有檔案」的舊紀錄
  const logsStore = blobs.getStore('strat-edge-logs');
  const filesStore = blobs.getStore('strat-edge-files');
  const seedRecords = [];
  for (let i = 0; i < 20; i++) {
    const id = 'seed-' + i;
    await filesStore.set(id, 'dummy-file-content-' + i);
    seedRecords.push({ id, type: 'download', email: 'old-user@example.com', name: '舊使用者', isAnonymous: false, fileId: id, reportName: 'old-' + i, time: new Date().toISOString() });
  }
  await logsStore.setJSON('all-events', seedRecords);

  const calls = [];
  // 30個新的匿名下載事件
  for (let i = 0; i < 30; i++) {
    calls.push(logEvent.handler(fakeEvent({ type: 'download', reportName: 'new-report-' + i }), fakeAnonymousContext()));
  }
  // 同時刪除20筆舊紀錄的檔案
  for (let i = 0; i < 20; i++) {
    calls.push(deleteDownload.handler(fakeEvent({ id: 'seed-' + i }), fakeAdminContext()));
  }

  const responses = await Promise.all(calls);
  responses.forEach(r => assert.strictEqual(r.statusCode, 200, '每一次呼叫都應該成功回傳200，實際: ' + JSON.stringify(r)));

  const finalAll = await logsStore.get('all-events', { type: 'json' });
  assert.strictEqual(finalAll.length, 50, `最終應有 50 筆（20舊+30新），實際 ${finalAll.length} 筆`);

  const oldOnes = finalAll.filter(r => r.id.startsWith('seed-'));
  assert.strictEqual(oldOnes.length, 20, '20筆舊紀錄本身不應該被移除，只是清空fileId');
  oldOnes.forEach(r => {
    assert.strictEqual(r.fileDeleted, true, `${r.id} 應該被標記為已刪除`);
    assert.strictEqual(r.fileId, undefined, `${r.id} 的 fileId 應該被清空`);
  });

  const newOnes = finalAll.filter(r => r.reportName && r.reportName.startsWith('new-report-'));
  assert.strictEqual(newOnes.length, 30, `30筆新下載紀錄都應該存在，實際 ${newOnes.length} 筆（代表新紀錄在併發中被覆蓋遺失）`);
});

record('刪除不存在的紀錄應立即回傳404，且只讀取一次(不應該浪費重試次數)', async ({ deleteDownload, blobs }) => {
  const logsStore = blobs.getStore('strat-edge-logs');
  await logsStore.setJSON('all-events', []);
  const before = blobs.__mock__.getStoreBacking('strat-edge-logs').get('all-events').etag;

  const res = await deleteDownload.handler(fakeEvent({ id: 'not-exist' }), fakeAdminContext());
  assert.strictEqual(res.statusCode, 404);

  const after = blobs.__mock__.getStoreBacking('strat-edge-logs').get('all-events').etag;
  assert.strictEqual(before, after, '驗證失敗時不應該有任何寫入動作發生');
});

record('刪除一筆本來就沒有檔案的紀錄應回傳400', async ({ deleteDownload, blobs }) => {
  const logsStore = blobs.getStore('strat-edge-logs');
  await logsStore.setJSON('all-events', [{ id: 'no-file-record', type: 'download' }]);

  const res = await deleteDownload.handler(fakeEvent({ id: 'no-file-record' }), fakeAdminContext());
  assert.strictEqual(res.statusCode, 400);
});

record('超過5000筆時仍會正確保留最新5000筆(沿用原有規則)', async ({ logEvent, blobs }) => {
  const logsStore = blobs.getStore('strat-edge-logs');
  const seed = [];
  for (let i = 0; i < 5000; i++) seed.push({ id: 'old-' + i, type: 'download', time: new Date().toISOString() });
  await logsStore.setJSON('all-events', seed);

  const res = await logEvent.handler(fakeEvent({ type: 'download', reportName: 'the-5001st' }), fakeAnonymousContext());
  assert.strictEqual(res.statusCode, 200);

  const all = await logsStore.get('all-events', { type: 'json' });
  assert.strictEqual(all.length, 5000, `應該維持5000筆上限，實際 ${all.length} 筆`);
  assert.strictEqual(all[0].id, 'old-1', '最舊的第0筆(old-0)應該被砍掉');
  assert.strictEqual(all[all.length - 1].id, JSON.parse(res.body).id, '新寫入的這筆應該存在於陣列最後面');
});

record('寫入衝突超過重試上限時應回傳明確的500錯誤，而不是靜默丟失或無限等待', async ({ freshLogEvent, blobs }) => {
  // 讓 setJSON 永遠回傳 modified:false，模擬「衝突永遠無法解決」的極端情境。
  // 注意：這裡故意動 MockStore.prototype.setJSON（所有實例共用），而不是改
  // module.exports.getStore ——因為 _utils.js 在 require 當下就已經把 getStore
  // 解構存成自己模組內的區域變數，事後才去改 module.exports 上的屬性並不會影響
  // _utils.js 手上那份已經抓到的參照，這裡要真的模擬「Blobs服務本身回應衝突」，
  // 必須從所有Store實例共用的prototype方法下手。
  const MockStore = blobs.__mock__.MockStore;
  const originalSetJSON = MockStore.prototype.setJSON;
  MockStore.prototype.setJSON = async function () { return { modified: false }; };

  try {
    const res = await freshLogEvent.handler(fakeEvent({ type: 'download', reportName: 'always-conflict' }), fakeAnonymousContext());
    assert.strictEqual(res.statusCode, 500, '重試次數耗盡應該回傳500，而不是假裝成功(200)造成資料靜默遺失');
    const body = JSON.parse(res.body);
    assert.ok(body.error, '應該有明確的錯誤訊息，方便從 Netlify functions log 看到');
  } finally {
    MockStore.prototype.setJSON = originalSetJSON;
  }
});

// ---------- 4. 執行 ----------

async function main() {
  installMockModule();
  try {
    const blobs = freshRequire('@netlify/blobs', [FUNCTIONS_DIR]);
    const utils = freshRequire(path.join(FUNCTIONS_DIR, '_utils.js'));
    const logEvent = freshRequire(path.join(FUNCTIONS_DIR, 'log-event.js'));
    const deleteDownload = freshRequire(path.join(FUNCTIONS_DIR, 'delete-download.js'));

    let passed = 0, failed = 0;
    for (const { name, fn } of results) {
      // 每個案例重新清空store，避免互相污染
      blobs.__mock__.stores.clear();
      // 每次都給一支「全新」的 log-event.js（給最後一個衝突測試用，避免污染其他案例共用的 getStore 參照）
      const freshLogEvent = freshRequire(path.join(FUNCTIONS_DIR, 'log-event.js'));
      try {
        await fn({ logEvent, deleteDownload, freshLogEvent, blobs, utils });
        console.log('✅ PASS -', name);
        passed++;
      } catch (e) {
        console.log('❌ FAIL -', name);
        console.log('   ', e && e.message);
        failed++;
      }
    }

    console.log('');
    console.log(`共 ${results.length} 項測試，通過 ${passed} 項，失敗 ${failed} 項`);
    if (failed > 0) {
      console.log('❌ 有測試失敗，請勿部署此版本');
      process.exitCode = 1;
    } else {
      console.log('✅ 全部通過');
      process.exitCode = 0;
    }
  } finally {
    uninstallMockModule();
  }
}

main().catch(e => {
  console.error('測試腳本本身發生未預期錯誤：', e);
  uninstallMockModule();
  process.exitCode = 1;
});
