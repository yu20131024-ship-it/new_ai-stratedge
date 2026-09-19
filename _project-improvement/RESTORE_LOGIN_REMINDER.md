# ⚠️ 提醒：登入功能目前處於「暫時停用」狀態（自 v2.3.36-testing 起，目前為 v2.3.37-testing）

這個檔案本身就是提醒——如果你看到它還在，代表登入關卡可能還沒恢復。

## 現況

應使用者要求，Google 帳號登入關卡已暫時停用，方便測試。**這只影響「要不要顯示
全螢幕登入遮罩」，後端 3 支 Netlify Functions 的身份驗證邏輯完全沒有被改動**——
也就是說，管理後台、下載紀錄等真正需要授權的功能，安全性沒有被削弱。

## 測試完畢後，請做這 3 件事還原

1. 打開 `index.html`，找到 `window.AUTH_GATE_DISABLED_FOR_TESTING = true`
   （在檔案開頭「Google 帳號登入關卡」區塊，緊接在 `<script src=".../netlify-identity-widget.js">`
   之後），改成 `false`（或整行刪除）。
2. 刪除緊接在後面的黃色提示條區塊：`<div id="auth-gate-testing-banner">...</div>`。
3. 刪除 `_project-improvement/tests/temp-auth-gate-disabled.test.js`
   （這支測試驗證的是「已停用」，登入恢復後它的斷言會失敗，屬於預期中失敗，
   直接刪除即可，不是真的迴歸）。

完成後，建議把版本號從 `v2.3.36-testing` 改回正式版本號，並執行一次
`node _project-improvement/tests/run-all.js` 確認其餘測試（8 組、127+ 項斷言）都還是綠燈。

完成還原後，這個提醒檔案本身也可以刪除。
