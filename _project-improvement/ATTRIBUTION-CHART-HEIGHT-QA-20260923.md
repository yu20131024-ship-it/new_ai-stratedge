# 歸因模擬長條圖高度修正與 QA — 2026-09-23

## 問題
歸因模擬頁籤的長條統計圖原先沿用全站 `.chart-box` 固定 34rem 高度，造成圖表實際內容結束後仍保留大面積空白。

## 修正
- 長條圖容器改為專用 `.attrib-chart-box`，不再繼承全站 34rem 固定高度。
- `height:auto` / `min-height:0` / `overflow:visible`。
- SVG 桌面最大寬度 640px，避免在大螢幕被無限制放大；手機則自動縮放至容器寬度。
- 圖表與下方「相對於目前假設平均分配」區塊維持 12px 間距。
- 保留白色卡片、邊框與陰影，提升圖表與背景的辨識度。

## QA
- JavaScript inline scripts：36 個，Node `--check` 全部通過。
- Desktop standalone visual QA：通過；容器 188px、SVG 154px，僅保留 34px 內距，不再有大段空白。
- Mobile 390px visual QA：通過；容器 108.8px、無水平溢出。
- 5 個歸因模型切換：程式結構檢查保留 5 個模型按鈕。
- Google 帳號登入維持暫時關閉。
