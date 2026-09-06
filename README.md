# 策引 AI — 部署與設定說明（Google 登入 + 管理後台）

**目前版本：v2.3.17**

## 版本紀錄
- **v2.3.17**：僅補上專案文件，無程式碼功能變更。新增 `docs/AI協作除錯指南.md`，記錄 v2.3.16 Google 登入疑難排解的完整經過與根本原因，並整理成「非IT/非工程背景使用者如何委任 AI 直接處理問題」的溝通指南與可複製開場白範本。
- **v2.3.16**：修復「使用 Google 帳號登入」按鈕點擊沒反應的問題。根本原因是 Netlify Identity widget 彈出的登入小視窗有官方已知的 z-index 疊層臭蟲（github.com/netlify/netlify-identity-widget/issues/94、#67），本頁全螢幕登入遮罩的 z-index 比登入小視窗還高，導致小視窗雖然有正常開啟，卻被整個蓋住看不到。已強制登入視窗 z-index 為最大值，並新增「改用直接跳轉登入」備用連結。
- **v2.3.15**：管理後台新增「刪除檔案」功能。管理者可在下載紀錄旁點擊「🗑 刪除」，移除該筆下載實際儲存的檔案內容；刪除後紀錄仍保留（登入者、時間、檔名），只有檔案本體變成「無檔案」並標註刪除者與刪除時間。
- **v2.3.14 以前**（即前一次交付）：Google 帳號登入關卡、管理後台（登入紀錄／IP／瀏覽器／下載紀錄／重新下載檔案）。

這個資料夾是一個完整的 Netlify 專案，包含：
- `index.html` — 主應用程式（已加入 Google 登入關卡與管理後台入口）
- `netlify/functions/` — 3 支伺服器端函式，負責記錄登入/下載事件、管理者查詢
- `netlify.toml` — Netlify 建置設定
- `package.json` — 宣告 `@netlify/blobs` 依賴套件

## 一、把專案放上 GitHub

```bash
cd strat-edge-app
git init
git add .
git commit -m "初始版本：Google 登入 + 管理後台"
```

接著到 GitHub 建立一個新的（可設為 Private）repository，然後：

```bash
git remote add origin https://github.com/你的帳號/你的repo名稱.git
git branch -M main
git push -u origin main
```

## 二、連接 Netlify

1. 登入 [app.netlify.com](https://app.netlify.com)
2. 點「Add new site」→「Import an existing project」→ 選擇剛剛的 GitHub repo
3. Build command 留空、Publish directory 填 `.`（因為是純靜態網站＋functions，不需要建置指令）
4. 點「Deploy site」

## 三、啟用 Netlify Identity（Google 登入）— 重點步驟

1. 進入你的 Netlify 網站後台 → **Project configuration**（或 Site configuration）→ **Identity**
2. 點 **Enable Identity**
3. 往下找到 **Registration** 設定：
   - 建議把 Registration 設為 **Invite only**（僅限邀請）——這樣才不會有陌生人自己註冊帳號進來用你的分析工具。之後你要讓誰使用，就到 Identity 分頁手動「Invite user」輸入對方 email。
4. 找到 **External providers**（外部登入提供者）：
   - 打開 **Google** 這個選項即可，**不需要**自己申請 Google Cloud OAuth Client ID（Netlify 會用它自己的共用 Google 應用程式幫你處理，使用者在 Google 同意畫面上會看到「Netlify Identity」字樣，這不影響功能）。
   - 如果你之後想讓使用者在 Google 登入畫面看到「策引 AI」而不是「Netlify Identity」，才需要自己申請 Google Cloud OAuth Client ID 並填入這裡的欄位，這是選配，不是必要條件。

完成後，重新整理你的網站，應該就會看到登入關卡畫面，按「使用 Google 帳號登入」即可測試。

## 四、確認 Blobs 功能已生效

`@netlify/blobs` 是 Netlify 平台內建功能，只要網站是透過 Netlify 部署，`netlify/functions/` 裡的程式碼呼叫 `getStore(...)` 就會自動生效，**不需要**額外申請帳號或設定金鑰。

## 五、管理後台怎麼用

1. 用 `felix670131@gmail.com` 這個 Google 帳號登入網站（記得先在步驟三的 Identity 分頁裡，把這個 email 加進 Invite 名單，否則連登入都進不來）
2. 登入後，右上角會出現一個「🔒 管理後台」按鈕（其他帳號登入不會看到這個按鈕）
3. 點開後可以看到：
   - 每個使用者的登入次數、最後登入時間
   - 展開後可看到每一筆登入的 IP 位址、瀏覽器資訊
   - 每一筆下載紀錄（下載了什麼報告、什麼時候、什麼格式），並可以直接點「下載」重新取得那份檔案

這份資料存在 Netlify Blobs（伺服器端），不管你、或任何登入者換了電腦、換了瀏覽器，這些紀錄都還在，不會因為清瀏覽器快取或換裝置就消失。

## 六、之後要修改程式碼

以後不論是我這邊繼續幫你加功能，或是你自己想調整，流程都是：
1. 修改 `index.html`（或 `netlify/functions/` 裡的程式）
2. `git add . && git commit -m "說明這次改了什麼" && git push`
3. Netlify 偵測到 GitHub 有新的 commit，會自動重新部署，通常 1-2 分鐘內就會上線新版本

## 七、需要注意的限制（誠實說明）

- Netlify Identity 是給「一般網站的訪客登入」使用，如果未來使用者規模變大（例如超過幾千人），會建議换成更完整的身份驗證服務（例如 Auth0），但目前規模下完全夠用。
- Netlify Blobs 沒有像正式資料庫一樣的複雜查詢功能（不能下 SQL 篩選），這個 MVP 版本是把全部紀錄整包讀出來、在瀏覽器端做分組顯示，使用者與下載紀錄數量在幾千筆以內都不會有效能問題；如果之後用量大幅成長，會建議改用正式資料庫（例如 Supabase）。
- 瀏覽器端 JavaScript 本質上都可以被使用者用「檢視原始碼」看到，但這不影響安全性：真正決定「誰能看管理後台資料」的判斷完全在 `netlify/functions/admin-logs.js` 這支伺服器端程式碼裡，前端只是負責要不要「顯示按鈕」的體驗優化。
