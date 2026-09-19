# 階段6 前置盤點：全站色碼 → 語意 token 映射建議

> 產生方式：`node _project-improvement/tools/color-inventory.js index.html`
> 基準版本：v2.3.32　｜　**本文件只是分析，未修改任何程式碼**

## 1. 現況

- 相異色碼 **569 種**，合計出現 **2412 次**
- 路線圖階段6 的目標是收斂到 **≤20 個語意 token**；依下表分群，**12 個語意分組即可涵蓋全部色碼**，目標可達成

## 2. 語意分群與建議代表值

分群規則（寫在工具裡，可人工覆核）：**先看明度、再看色相**。
這一點很重要——本專案是深色主題，大量「帶藍調的深色」（如 `#102033`、`#172033`）在色相上屬於藍色，
但語意上其實是背景／表面色。第一版分類器先用色相分群，結果把 338 種中性深色誤判成主色（primary），
修正為「明度優先」後才得到下表這份可用的結果。**這類分群誤判如果直接拿去做 codemod，會把整個深色主題洗成藍色。**

| 語意 token | 色碼種數 | 出現次數 | 建議代表值 | 出現最多的前 6 個 |
|---|---:|---:|---|---|
| `--color-text` | 100 | 708 | `#ffffff` | `#ffffff`(318) `#f8fbff`(103) `#f4f9ff`(31) `#f5f9ff`(19) `#f8fafc`(13) `#eef3f8`(12) |
| `--color-primary` | 181 | 444 | `#bdd7ee` | `#bdd7ee`(26) `#dce5f0`(20) `#334155`(14) `#dbe7f6`(14) `#64748b`(13) `#4b8cff`(11) |
| `--color-bg` | 61 | 437 | `#102033` | `#102033`(230) `#0f172a`(50) `#0d121b`(11) `#111827`(10) `#142033`(9) `#0b111c`(9) |
| `--color-surface` | 46 | 289 | `#172033` | `#172033`(124) `#142236`(42) `#1e3a5f`(11) `#0f2b46`(10) `#152033`(8) `#152941`(8) |
| `--color-accent` | 69 | 194 | `#2dcbdf` | `#2dcbdf`(28) `#53d6c7`(19) `#7de8f4`(10) `#9be8ff`(8) `#126f86`(6) `#2f9aa4`(6) |
| `--color-danger` | 31 | 170 | `#dc2626` | `#dc2626`(25) `#8b1e1e`(22) `#ff0000`(22) `#a01818`(16) `#ff1f1f`(13) `#d71920`(10) |
| `--color-success` | 28 | 62 | `#63e6b1` | `#63e6b1`(11) `#059669`(6) `#6fe4a8`(6) `#22c55e`(4) `#a7f3d0`(3) `#6ee7b7`(3) |
| `--color-warning` | 29 | 48 | `#f2b21e` | `#f2b21e`(6) `#92400e`(4) `#f6d23f`(4) `#f97316`(3) `#f59e0b`(2) `#7c2d12`(2) |
| `--color-info` | 6 | 18 | `#7a50cc` | `#7a50cc`(10) `#b58cff`(3) `#7c3aed`(2) `#5b21b6`(1) `#d59bff`(1) `#e3d9f7`(1) |
| `review` | 8 | 17 | `#ff3df2` | `#ff3df2`(5) `#9a1a82`(4) `#ff6b9d`(2) `#ef5da8`(2) `#ff6f9b`(1) `#ff7fb0`(1) |
| `--color-border` | 6 | 13 | `#6b7280` | `#6b7280`(7) `#4b5563`(2) `#6f7b90`(1) `#6f7a8d`(1) `#687386`(1) `#666666`(1) |
| `--color-text-muted` | 4 | 12 | `#e5e7eb` | `#e5e7eb`(6) `#9ca3af`(4) `#8a8f98`(1) `#a4a8b7`(1) |

## 3. 對比度速查（WCAG AA：一般文字 ≥4.5:1、大字/圖示 ≥3:1）

見工具輸出的最後一段。已知需要注意的幾組：

- `--color-danger` 的建議代表值 `#dc2626` 在深色底上僅約 **4.22:1**，**達不到一般文字的 4.5:1**。
  這是既有問題（不是本次改動造成），建議收斂時把危險色的「文字用」與「邊框／圖示用」拆成兩個 token，
  文字用改採明度更高的紅（例如 `#f87171` 這類），邊框／背景用維持深紅。
- `--color-info`（`#7a50cc`）約 3.73:1，同樣只適合大字與圖示。
- `--color-primary` 這一組仍有 181 種色碼，**分群把「淺藍文字」與「中藍強調」混在一起**，
  是全表中最需要人工再細分的一組（建議至少拆成 `--color-primary` 與 `--color-primary-soft` 兩個）。

## 4. 為什麼先盤點、不直接 codemod

本專案 PROGRESS.md 第3節鐵律第 9、11 條記載了三次事故，共同點是：
**靜態比對全部過關，只有真實瀏覽器截圖才抓得到錯**。色碼收斂會大量動到
`border` / `background` 這類簡寫屬性，正是鐵律第 11 條點名最容易出錯的地方。
加上本次執行環境無瀏覽器、`visual-regression-check.py` 無法執行，
因此**刻意只做到盤點與映射建議為止**。

## 5. 建議的執行順序（給下一位接手者）

1. 人工覆核本表，特別是 `--color-primary`（181 種）與 `review` 組
2. 在 `:root` 定義收斂後的語意 token（現有 144 個變數已集中在單一 `:root`，v2.3.30 已完成）
3. 寫 codemod **一次只處理一個語意分組**，每組替換後立刻跑 `visual-regression-check.py`
4. 先從色碼種數最少、風險最低的組開始（`--color-border` 6 種、`--color-info` 6 種、`--color-text-muted` 4 種）
5. 危險色與主色留到最後，且務必先解決上述對比度不足的問題


---

## 6. v2.3.35 更新：危險色收斂——已完成安全子集，其餘已產出可審閱的執行計畫

路線圖原文點名的範例正是「同語意危險色 ≥4 種（#DC2626/#FF0000/#8B1E1E/#A01818）」，
本節記錄這 4 種色碼的實際收斂進度。

### 已套用（零視覺風險，本版已直接執行）

`#DC2626` → `var(--danger)`，共 **18 處**（僅限主畫面自身 `<style>` 內容，已排除報告匯出範本與
token 定義行本身）。**這一組之所以能直接套用而不必等瀏覽器驗證**：`--danger` 本身的定義值
就是 `#DC2626`，替換後瀏覽器算出來的顏色逐位元相同——這是單純的去重複，不是視覺變更。
已由 `tests/stage6-color-consolidation.test.js`（5 項）驗證。

### 尚未套用（會改變實際顯示顏色，需視覺驗證後才能執行）

`#FF0000`（10 處）、`#8B1E1E`（12 處）、`#A01818`（10 處）合計 **32 處**若收斂到
`var(--danger)`，渲染出來的顏色會**真的改變**（分別變暗、變亮、變亮），這是刻意的視覺統一，
不是純重構。依本文件鐵律第 9、11 條的教訓，這類改動未經真實瀏覽器截圖比對前不應執行。

新增 `tools/plan-color-consolidation.js`：乾跑（dry-run）規劃工具，預設只產出報告、
不修改任何檔案；每一處待替換位置都附上所在行號與 CSS 上下文，供人工審閱。
有瀏覽器的接手者可直接執行：

```bash
node _project-improvement/tools/plan-color-consolidation.js index.html --apply
```

會輸出 `index.color-consolidated.html`（**不覆蓋原檔**），請比對後再決定是否取代，
並在套用前後各跑一次 `visual-regression-check.py` 做真實截圖比對。

以下是目前的完整乾跑報告：

```

=== 階段6：危險色收斂 —— 乾跑規劃報告（未修改任何檔案）===

--danger 現行值：#DC2626

範圍：僅限主畫面自身的 <style> 內容，已排除報告匯出範本；共找到 32 處待替換。

#FF0000 → var(--danger)　共 10 處　純紅，明顯偏亮，收斂後會變暗，需視覺確認
  行 24603：color: #ff0000 !important;
  行 24604：-webkit-text-fill-color: #ff0000 !important;
  行 24615：color: #ff0000 !important;
  行 24616：-webkit-text-fill-color: #ff0000 !important;
  行 24926：color: #ff0000 !important;
  行 24927：-webkit-text-fill-color: #ff0000 !important;
  ……以及其餘 4 處

#8B1E1E → var(--danger)　共 12 處　暗紅，收斂後會變亮，需視覺確認
  行 21902：color:#8b1e1e!important;
  行 21903：-webkit-text-fill-color:#8b1e1e!important;
  行 22181：color:#8b1e1e!important;
  行 22182：-webkit-text-fill-color:#8b1e1e!important;
  行 22200：color:#8b1e1e!important;
  行 22201：-webkit-text-fill-color:#8b1e1e!important;
  ……以及其餘 6 處

#A01818 → var(--danger)　共 10 處　暗紅，收斂後會變亮，需視覺確認
  行 23846：color:#a01818!important;
  行 23847：-webkit-text-fill-color:#a01818!important;
  行 23857：color:#a01818!important;
  行 23858：-webkit-text-fill-color:#a01818!important;
  行 23871：color:#a01818!important;
  行 23872：-webkit-text-fill-color:#a01818!important;
  ……以及其餘 4 處

提醒：本工具預設只產出報告。實際套用請在有瀏覽器的環境執行 --apply，
      並在套用前後各跑一次 visual-regression-check.py 做真實截圖比對（鐵律第9、11條）。

```
