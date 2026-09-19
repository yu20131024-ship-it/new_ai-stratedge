# 分析工具

這裡的腳本是階段3、階段4、階段5分析／改善 `index.html` 時寫的工具，留在這裡供未來任何
階段（尤其是階段6/7實際合併補丁時）或其他AI重複使用、重新驗證，不用每次都重寫一遍。

使用前請先在專案根目錄執行一次 `npm install`（會安裝 `devDependencies` 裡的
`acorn`／`parse5`／`postcss`／`postcss-selector-parser`／`jsdom`，只影響本機開發
環境，不影響 Netlify 正式部署）。另外 `visual-regression-check.py` 需要另外
`pip install playwright pillow` 並執行 `playwright install chromium`。

所有 Node 工具都是「輸入一個 index.html 路徑，輸出分析結果」，用法：

## verify-script-boundaries.js
```
node _project-improvement/tools/verify-script-boundaries.js index.html
```
用符合 HTML5 規範的 parse5 解析器，精確列出檔案裡每一個真正的 `<script>` 標籤邊界。
**每次改動 index.html 之後都應該重跑一次**，確認結構沒有被意外破壞（例如新增內容不小心
含有會提前結束標籤的文字）。

## verify-style-boundaries.js
```
node _project-improvement/tools/verify-style-boundaries.js index.html
```
跟上面同樣道理，但檢查對象是 `<style>` 標籤。**階段5第一次嘗試合併補丁時，說明用的
註解文字裡不小心寫了字面上的`</style>`**，導致該標籤被瀏覽器提前截斷——但因為HTML
解析對這種錯誤有容錯、後面文字會被當成別的東西繼續解析，最後拼出來的CSS規則「總量」
剛好還是對的，光看CSS規則內容比對完全看不出問題，只有直接檢查「真正有幾個`<style>`
標籤、每個的邊界在哪裡」才抓得到。**之後任何會產生或合併`<style>`/`<script>`標籤
內容的操作，都必須同時跑這兩支邊界驗證工具，不能只看CSS/JS的規則內容比對就安心。**

## find-collisions.js
```
node _project-improvement/tools/find-collisions.js index.html
```
用 acorn 把每個「未包IIFE、真正共用全域作用域」的 `<script>` 區塊解析成語法樹，
只統計真正的頂層宣告，找出會互相覆蓋的同名函式/變數。**階段3的`esc()`誤判**就是因為
一開始只用簡易文字搜尋、沒有真正解析語法樹才誤判的，之後懷疑有命名碰撞時應該用這支
腳本確認，不要只憑 grep 判斷。

## classify-style-patches.js
```
node _project-improvement/tools/classify-style-patches.js index.html [輸出檔名.json]
```
掃描所有帶 `id` 的 `<style>` 補丁區塊，依 id 命名與內容關鍵字自動分類（配色/字型/間距/
互動狀態/跨裝置相容/文字可讀性/強制覆蓋層/bug修正/元件外觀），用 `postcss` +
`postcss-selector-parser`（能正確處理 `:is()`/`:not()` 括號內逗號的複合選擇器，
不會被naive文字比對誤導）找出被多個補丁重複碰過的「熱點選擇器」。階段4的
`stage4-patches-inventory.md` 就是用這支腳本的輸出產生的。

## classify-script-patches.js
```
node _project-improvement/tools/classify-script-patches.js index.html [輸出檔名.json]
```
掃描所有帶 `id` 的 `<script>` 補丁區塊，判斷是否為IIFE包裝（作用域獨立、風險較低）、
是否含DOMContentLoaded監聽器、是否會動態修改樣式等，並依id命名分類。

## extract-root-variables.js
```
node _project-improvement/tools/extract-root-variables.js index.html [輸出檔名.md]
```
追蹤所有 `:root { --xxx: ... }` 定義（可能分散在主樣式表與多個style補丁裡），
依文件出現順序算出「每個CSS變數目前真正生效的值」——後面定義的會蓋過前面的。
階段4發現`:root`被重複定義10次、144個變數的最終生效值分散在5個不同地方，就是
用這支腳本算出來的，是階段6整理配色系統的依據。

## visual-regression-check.py
```
python3 _project-improvement/tools/visual-regression-check.py 改動前.html 改動後.html [輸出資料夾]
```
用真實瀏覽器（Playwright + Chromium）把兩個版本的index.html實際截圖、逐像素
比對差異。這是CSS結構比對之外的「眼見為憑」驗證——階段5的實際案例證明了：CSS
規則內容/AST比對顯示完全一致，不代表HTML標籤結構真的正確，兩種驗證方式要一起
用才夠嚴謹。使用前建議先讀懂腳本開頭的說明註解，裡面記錄了這個環境已知的限制
（外部CDN連線會被擋、Math.random()造成的非決定性雜訊基準值約在0.01%像素以內）。

## stage5-merge-script-used.js（階段5專用稽核紀錄，非通用工具）

階段5實際用來合併補丁的腳本（找出「真正逐位元組緊鄰、中間沒有夾雜其他內容」的
連續小型補丁串，合併成一個`<style>`區塊）。保留在這裡作為稽核紀錄，**不是**
通用工具——它的合併範圍是根據執行當下 index.html 裡「還剩下哪些補丁」動態算出來
的，重新對現在的檔案執行不會有意義的結果。腳本開頭記錄了完整的教訓（合併時
「相鄰」的判斷方式踩過的坑），未來階段6/7如果要處理剩餘補丁，建議參考這支腳本
的邏輯重新寫一份。

## 重要提醒

這些工具本身只是「唯讀分析」，不會修改 `index.html`。但分析結果的準確度取決於
`index.html` 目前的真實結構——如果之後把匯出報告的樣板字串結構改掉（例如切成外部
檔案），這幾支腳本裡「排除樣板字串內容」的判斷方式可能需要跟著調整（目前是靠parse5
正確處理HTML語意來自然排除，理論上不需要額外調整，但建議調整後仍要重跑一次確認
輸出數字合理）。

**鐵律**：任何會修改 `<style>`/`<script>` 標籤內容或結構的操作，完成後都必須依序跑：
1. `verify-style-boundaries.js` 與 `verify-script-boundaries.js`（結構完整性）
2. `find-collisions.js`（全域命名碰撞）
3. CSS規則內容或AST比對（內容/順序完全不變）
4. `visual-regression-check.py`（真實瀏覽器視覺回歸）

四項全過才能視為安全，**任何一項單獨通過都不足以保證安全**——階段5的實際教訓就是
「CSS規則內容比對顯示完全一致」，但標籤結構其實已經壞了，只有加上結構驗證才抓到。

---

## v2.3.31 新增：零依賴版驗證工具

本專案原有的 `verify-style-boundaries.js`／`verify-script-boundaries.js` 需要 `parse5`，
`visual-regression-check.py` 需要 Playwright。若接手環境**無對外網路、無法 `npm install`**，
這些工具會完全跑不起來。以下兩支是零依賴的替代品，任何裝了 Node 的環境都能直接執行：

```bash
node _project-improvement/tools/check-inline-js-syntax.js index.html
node _project-improvement/tools/verify-tag-boundaries-nodeps.js index.html
```

- `check-inline-js-syntax.js`：把每個 inline `<script>` 區塊各自寫成暫存檔跑 `node --check`，
  逐一回報語法錯誤與所在行號。字串替換不慎打壞程式結構時，這支會第一時間攔下來。
- `verify-tag-boundaries-nodeps.js`：以「瀏覽器對 raw-text 元素的掃描行為」重現標籤邊界判定
  （只要看到 `</style` 或 `</script` 字元序列就結束標籤，不管它寫在不寫在註解裡），
  回報每個標籤的起訖行號、內容長度與邊界異常數。**這正是鐵律第 9 條那次事故的偵測方式**；
  v2.3.31 執行期間它也確實再次攔下同一類問題（版本歷史註解中寫了字面上的標籤文字）。

⚠️ 這兩支**不能取代**真實瀏覽器視覺回歸。在有瀏覽器的環境仍請照常跑
`visual-regression-check.py`，四層驗證缺一不可。

### `color-inventory.js`（v2.3.32 新增，階段6 前置）

```bash
node _project-improvement/tools/color-inventory.js index.html          # 人類可讀報表
node _project-improvement/tools/color-inventory.js index.html --json   # 機器可讀，供 codemod 使用
```

盤點全站 hex 色碼，依「明度優先、色相其次」分群為語意 token，並附 WCAG 對比度速查。
**只分析，不修改任何檔案。** 產出的分析結果見 `_project-improvement/stage6-color-inventory.md`。

⚠️ 分群結果**必須人工覆核**：第一版分類器採色相優先，把 338 種中性深色誤判為主色，
若直接拿去 codemod 會把整個深色主題洗成藍色。詳見 PROGRESS.md 第 12 節。

---

## v2.3.38 新增：階段6／7 相關工具

```bash
node _project-improvement/tools/raw-html-tokenizer.js       # 共用模組，供其他工具 require
node _project-improvement/tools/plan-color-consolidation.js index.html [--apply]
node _project-improvement/tools/analyze-patch-merge-safety.js index.html
node _project-improvement/tools/merge-adjacent-patches.js index.html <style|script> [manifest.json]
```

`verify-tag-boundaries-nodeps.js`／`check-inline-js-syntax.js` 已升級為 comment-aware
tokenizer（詳見 PROGRESS.md 第17節）：正確排除 HTML 註解與報告匯出範本內嵌字串裡
的字面樣式／腳本標籤文字，不會再被誤判成真標籤。**這是目前對「全檔真正有幾個
style/script 標籤」最準確的量測方式**；早期文件記載的「79／80個 style 標籤」
是用天真正則量出的虛高數字，實際基準是 57 個。

`merge-adjacent-patches.js`：只合併「真正緊鄰、且只帶 id 屬性（不帶 src/onerror
等其他屬性）」的標籤，並在合併時輸出精確的 manifest 供逐字元驗證。不相鄰的補丁
不會被搬動。
