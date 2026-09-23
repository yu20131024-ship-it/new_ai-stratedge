# Google 帳號登入暫停測試模式

日期：2026-09-23

目前版本暫時關閉前端 Google / Netlify Identity 登入功能，方便進行 API、UI 與一般使用流程測試。

- 不顯示 Google 登入遮罩。
- 不載入 Netlify Identity widget。
- 不執行 `netlifyIdentity.init()`。
- 登入與登出按鈕在測試模式隱藏。
- 下載紀錄仍可依既有匿名流程送至後端。
- 管理後台仍保留伺服器端身份驗證，未因測試模式而放寬權限。

測試完成後，恢復登入時需要重新載入 Netlify Identity widget，並恢復原本的 auth gate / init / login / logout 邏輯。
