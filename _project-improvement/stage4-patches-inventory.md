# 階段4：Style／Script 補丁完整盤點清單

本檔案由工具程式（見 `_project-improvement/tools/`）直接掃描 `index.html` 產生，非人工整理，
資料來源：111 個真實 style 補丁 ＋ 30 個真實 script 補丁
（依出現順序排列，也就是 CSS 層疊套用順序：越後面的越晚生效、優先權越高）。

## 重點摘要（先看這裡）

1. **重要更正**：階段1診斷寫的「130個style補丁」其實是**111個真正在index.html主頁面上的補丁**，加上**19個**位於「產生獨立下載報告」功能組出的樣板字串裡（那是匯出文件自己的樣式，不是主頁面的）。111+19=130，數字對得起來，只是原本沒有分清楚是兩份不同的文件。**本階段4以及未來階段5/6/7的合併工作，範圍都是這111個主頁面的真正補丁**，19個匯出文件內的另計，不影響使用者平常操作app看到的畫面。
2. **`:root`（CSS設計變數的根定義）被重複定義了10次**：1次在主樣式表，另外9次分散在4個不同的「全站主題重做」補丁裡（`inlined-linear-modern-theme-for-ai-marketing2`／`inlined-enterprise-saas-polish`／`inlined-non-generic-product-polish`／`inlined-v11-dark-theme-restore`）。曾經被定義過的CSS變數共144個，但因為疊加覆蓋的關係，**目前真正生效的144個變數的值，分別來自5個不同的地方**（見本文件D節），等於現在的配色系統是4次不同「重新設計主題」的斷簡殘篇拼湊而成。這個發現比階段1原本估計的更嚴重，也更精確地解釋了④配色不一致的根本原因。
3. 有2個補丁特別龐大，合併時要拆成更小的批次處理，不能一次整包搬：
   - `global-final-readability-polish`（341條規則、1326個!important，橫跨2600-5022行，共2422行）
   - `inlined-non-generic-product-polish`（478條規則、477個!important，橫跨6604-9837行，共3233行，且內含6個獨立的`:root`區塊）
   - 這兩個補丁加起來就佔了全部111個補丁裡快一半的規則數量。
4. `.scenario-card`／`.summary-card`／`.card`／`.insight-card`等共用元件外框，以及`.form-ctrl`／`.brand-mark`等共用元件，是被最多不同補丁反覆疊加修改的「熱點」（詳見C節，已用正確處理`:is()`/`:not()`括號內逗號的選擇器解析器計算，非簡易文字比對），合併時這些地方風險最高，需要最後、最小心地處理。

## 對階段5/6/7的建議（請你確認是否同意，之後才會照這個順序實際動手）

原計畫階段5/6/7分別是「合併第一批視覺影響最小的補丁」「合併配色補丁」「合併script補丁」，
根據以上發現，建議把實際執行拆得更細（**這只是調整動手的批次順序與顆粒度，不改變整體6個重大缺失與12大階段的框架**）：

- **階段5**：先合併「小型、不碰:root、不在熱點選擇器清單裡」的獨立補丁（約60-70個，逐一或分小批合併，每次合併完都跑一次視覺對照）。
- **階段6**：處理配色與`:root`——先產出D節那張「最終生效值總表」對應的單一乾淨`:root`區塊，取代4個「主題重做」補丁裡分散的9個`:root`定義，這是配色一致性問題的真正核心修復。
- **階段7**：處理`global-final-readability-polish`與`inlined-non-generic-product-polish`這兩個超大型補丁，以及script補丁的整併——這兩個大補丁本身可能需要再切成2-3個子回合分開驗證，不會一次全部搬完。

## A. Style 補丁清單（共 111 個，依套用順序）

| # | id | 行號 | 規則數 | !important數 | 分類 | 主要選擇器(前5個) |
|---|---|---|---|---|---|---|
| 1 | `asset-studio-dashboard-force` | 776-795 | 18 | 14 | 配色、強制覆蓋層、元件外觀 | #screen-3 .page-top-banner .banner-analytics、#screen-3 .page-top-banner .pro-data-card、#screen-3 .page-top-banner .pro-data-card::before、#screen-3 .pro-card-head、#screen-3 .pro-card-title |
| 2 | `all-analysis-dashboard-force` | 796-889 | 37 | 97 | 配色、強制覆蓋層、元件外觀 | .page-top-banner .banner-analytics、.page-top-banner .mini-dashboard-card、.analytics-hero-panel .hero-metric、.analytics-hero-panel .hero-chart、.analytics-hero-panel .hero-line |
| 3 | `analysis-chart-size-force` | 890-937 | 44 | 70 | 強制覆蓋層 | .page-top-banner、.page-top-banner .banner-analytics、.page-top-banner .mini-dashboard-card、.page-top-banner .mini-dashboard-card.line span、.page-top-banner .mini-dashboard-card.donut span |
| 4 | `all-screens-chart-frame-force` | 938-1086 | 20 | 38 | 強制覆蓋層 | #screen-1 .page-top-banner、#screen-2 .page-top-banner、#screen-3 .page-top-banner、#screen-4 .page-top-banner、#screen-1 .banner-analytics |
| 5 | `global-hover-input-contrast-force` | 1087-1277 | 20 | 84 | 配色、互動狀態、強制覆蓋層 | .form-ctrl、input.form-ctrl、select.form-ctrl、textarea.form-ctrl、.form-ctrl::placeholder |
| 6 | `remove-decorative-mini-icons-force` | 1278-1313 | 2 | 15 | 強制覆蓋層 | .mini-analytics、.mini-bars、.mini-trend、.mini-signal、.mini-insight-chart |
| 7 | `content-card-hover-readability-force` | 1314-1356 | 6 | 20 | 配色、互動狀態、文字可讀性、強制覆蓋層、元件外觀 | .comp-card:not(:hover):not(:focus-within) .comp-card-name、.comp-card:not(:hover):not(:focus-within) .comp-flag、:is(.comp-card,.insight-card,.scenario-card,.summary-card,.experiment-card,.timeline-card,.prompt-item,.mpl-item,.copy-block,.env-factor,.scenario-fit,.done-box):is(:hover,:focus-within)、:is(.comp-card,.insight-card,.scenario-card,.summary-card,.experiment-card,.timeline-card,.prompt-item,.mpl-item,.copy-block,.env-factor,.scenario-fit,.done-box):is(:hover,:focus-within)
  :is(.comp-card-name,.comp-card-row,.comp-card-row b,.comp-flag,.comp-card-source,.comp-card-source a,.insight-title,.insight-sub,.insight-body,.insight-body b,.scenario-q,.scenario-fit,.scenario-metric,.scenario-metric b,.summary-label,.summary-value,.experiment-title,.experiment-hypothesis,.experiment-steps,.experiment-meta,.experiment-meta b,.experiment-meta span,.timeline-card span,.prompt-item-title,.prompt-item-text,.mpl-item-title,.mpl-item-text,.copy-block,b,strong,p,small,label,span:not(.gicon):not(.num):not(.flow-nav-index):not(.badge):not(.search-badge):not(.experiment-score):not(.scenario-tag))、:is(.comp-card,.insight-card,.scenario-card,.summary-card,.experiment-card,.timeline-card,.prompt-item,.mpl-item,.copy-block,.env-factor,.scenario-fit,.done-box):is(:hover,:focus-within)
  :is(.comp-card-row,.insight-body,.scenario-fit,.experiment-meta div,.copy-block) |
| 8 | `visual-contrast-balance-force` | 1357-1473 | 18 | 52 | 配色、強制覆蓋層 | #analysis-loading .analysis-visual、#analysis-loading .analysis-visual::before、#analysis-loading .analysis-visual::after、#analysis-loading .analysis-visual-head、#analysis-loading .analysis-visual-caption |
| 9 | `frame-glow-and-competitor-text-force` | 1474-1552 | 11 | 34 | 配色、文字可讀性、強制覆蓋層 | .comp-card:not(:hover):not(:focus-within)、.comp-card:not(:hover):not(:focus-within)
  :is(.comp-card-name,.comp-flag,.comp-card-row,.comp-card-row b,.comp-card-source,.comp-card-source a,span,b,strong,p,small,label)、.comp-card:not(:hover):not(:focus-within) .comp-card-row、.comp-card:not(:hover):not(:focus-within) .comp-card-row b、.comp-card:not(:hover):not(:focus-within) .comp-card-source a |
| 10 | `competitor-card-hard-readability-force` | 1553-1629 | 7 | 31 | 配色、文字可讀性、強制覆蓋層、元件外觀 | html body .comp-grid .comp-card、html body .comp-grid .comp-card:hover、html body .comp-grid .comp-card:focus-within、html body .insight-card:hover .comp-grid .comp-card、html body .card:hover .comp-grid .comp-card |
| 11 | `inline-expand-single-box-force` | 1630-1722 | 12 | 48 | 配色、強制覆蓋層 | .inline-expand、.inline-expand:hover、.inline-expand.expanded、.inline-expand-content、.inline-expand:not(.expanded):not(.no-expand) .inline-expand-content |
| 12 | `selected-card-dark-state-force` | 1723-1830 | 10 | 39 | 配色、強制覆蓋層、元件外觀 | .goal-btn.selected、.goal-btn.selected:hover、.goal-btn.selected:focus、.goal-btn.selected:focus-visible、.card:hover .goal-btn.selected |
| 13 | `swot-wheel-pastel-force` | 1831-2124 | 39 | 185 | 配色、強制覆蓋層 | #swot-grid.swot-wheel-layout、.swot-wheel-panel、.swot-wheel、.swot-petal、.swot-petal strong |
| 14 | `analysis-progress-scale-force` | 2125-2181 | 6 | 37 | 配色、強制覆蓋層 | #analysis-loading .analysis-loading-copy、#analysis-loading .analysis-percent、#analysis-loading .analysis-percent-value、#analysis-loading .analysis-percent-label、#analysis-loading .analysis-percent-track |
| 15 | `top-tech-banner-force` | 2182-2559 | 67 | 242 | 配色、強制覆蓋層 | .top-tech-banner、.top-tech-banner::before、.top-tech-banner::after、0%、45% |
| 16 | `goal-selected-readable-final-force` | 2560-2599 | 3 | 12 | 配色、強制覆蓋層 | html body .goal-grid .goal-btn.is-goal-active、html body .goal-grid .goal-btn.is-goal-active:hover、html body .goal-grid .goal-btn.is-goal-active:focus、html body .goal-grid .goal-btn.is-goal-active:focus-visible、html body .card:hover .goal-grid .goal-btn.is-goal-active |
| 17 | `global-final-readability-polish` | 2600-5022 | 341 | 1326 | 配色、文字可讀性、強制覆蓋層 | html body .compact-note summary:hover、html body .compact-note[open] summary、html body .compact-note[open] p、html body .compact-note:hover summary、html body .compact-note:hover p |
| 18 | `live-final-20260701-request-pass` | 5023-5197 | 26 | 82 | 配色、強制覆蓋層 | html、body、html body :is(.brand-text-sub,.top-tagline,.api-status-pill,.step-label,.form-hint,.btn-sm,.badge,.bench-table,.bench-source,.summary-label,.experiment-meta span,.ref-meta,.cite-note,.comp-card-row,.scenario-fit,.goal-btn .gdesc,.channel-confirm-status,.short-kicker,.model-dashboard-label)、html body :is(.page-title-strip,.page-top-banner h1,.page-top-banner h2,.page-head h1,.card-title,.insight-title,.hero-title,.tech-banner-copy h1,.section-title,.report-title)、html body :is(.card,.input-side-visual,.inline-analytics-banner,.analytics-hero-panel,.analytics-hero-panel-compact,.goal-btn,.channel-check-item,.compact-note,.static-note,.text-expand-body,.scenario-card,.env-factor,.comp-card,.summary-card,.experiment-card,.prompt-item,.mpl-item,.copy-block,.bench-section,.done-box,.modal-box,.page-head,.output-pane,.model-dashboard-card,.visual-card,.metric-card,.chart-card) |
| 19 | `live-final-20260701-night-polish` | 5198-5472 | 39 | 152 | 配色、強制覆蓋層 | html body .page-title-strip、html body #screen-1 .input-setup-stack、html body #screen-1 .input-setup-stack>.input-setup-row、html body #screen-1 .input-setup-stack>.input-setup-row::before、html body #screen-1 .input-setup-stack>.input-setup-row::after |
| 20 | `live-final-20260702-final-polish` | 5473-5694 | 35 | 106 | 配色、強制覆蓋層 | html body、html body .page-title-strip、html body .page-title-strip::before、html body .page-title-strip::after、html body :is(.card,.input-side-visual,.input-setup-row,.goal-btn,.channel-check-item,.compact-note,.static-note,.text-expand-body,.scenario-card,.env-factor,.comp-card,.summary-card,.experiment-card,.prompt-item,.mpl-item,.copy-block,.bench-section,.done-box,.model-dashboard-card,.visual-card,.metric-card,.chart-card,.swot-box,.swot-detail-grid,.desc-funnel-panel,.analysis-panel,.output-pane,.report-card) |
| 21 | `live-final-20260702-gap-and-visibility-fix` | 5695-5916 | 37 | 117 | 配色、間距版面、強制覆蓋層、bug修正 | html body、html body :is(p,li,label,input,textarea,select,button,td,th,small,span)、html body .page-title-strip、html body .page-title-strip::before、html body .page-title-strip::after |
| 22 | `inlined-linear-modern-theme-for-ai-marketing2` | 5917-6351 | 57 | 117 | 配色 | :root、html、body、body::before、body::after |
| 23 | `inlined-enterprise-saas-polish` | 6352-6603 | 40 | 25 | 配色 | :root、.top-header、.top-header-inner、.brand-mark、.brand-mark svg |
| 24 | `inlined-non-generic-product-polish` | 6604-9837 | 478 | 477 | 配色 | :root、html、body、body::before、body::after |
| 25 | `inlined-v11-dark-theme-restore` | 9838-10488 | 87 | 221 | 配色 | :root、html、body、body::before、body::after |
| 26 | `codex-20260702-badge-image-fix` | 10489-12223 | 164 | 964 | 配色、bug修正 | html body :is(.card-title .num,.num,.step-circle,.flow-nav-index,.step-num,.section-num,.page-badge,.env-rank,.scenario-tag,.experiment-score)、html body :is(.card,.input-setup-row,.input-panel,.input-fields,.input-side-visual,.channel-check-item,.compact-note,.static-note,.text-expand-body,.env-factor,.comp-card,.summary-card,.experiment-card,.prompt-item,.mpl-item,.copy-block,.bench-section,.done-box,.model-dashboard-card,.visual-card,.metric-card,.chart-card,.swot-box,.swot-detail-grid,.desc-funnel-panel,.analysis-panel,.output-pane,.report-card,.goal-btn,.scenario-card,.flow-nav-item):is(:hover,:focus-within,.selected,.is-selected,.is-goal-active) :is(.card-title .num,.num,.step-circle,.flow-nav-index,.step-num,.section-num,.page-badge,.env-rank,.scenario-tag,.experiment-score)、html body .card-title、html body #screen-1 .input-side-visual、html body #screen-1 .input-side-visual img |
| 27 | `v61-brand-mark-clean` | 12225-12229 | 3 | 7 | 待人工分類 | .brand-mark、.brand-mark img、.brand-mark::before、.brand-mark::after |
| 28 | `v62-api-modal-rulemode-and-provider-tabs-fix` | 12232-12327 | 6 | 46 | 配色、bug修正、元件外觀 | html body #api-modal .backend-note、html body #api-modal .backend-note:hover、html body #api-modal .backend-note:focus、html body #api-modal .backend-note:focus-within、html body #api-modal .backend-note:active |
| 29 | `v63-backend-note-white-lock` | 12330-12401 | 4 | 35 | 配色、強制覆蓋層 | html body #api-modal .backend-note、html body #api-modal .backend-note:hover、html body #api-modal .backend-note:focus、html body #api-modal .backend-note:focus-within、html body #api-modal .backend-note:active |
| 30 | `channel-confirm-text-visibility-fix` | 12404-12431 | 3 | 9 | 配色、文字可讀性、bug修正 | html body #channel-confirm-btn、html body #channel-confirm-btn .channel-confirm-label、html body #channel-confirm-btn *、html body #channel-confirm-btn:hover、html body #channel-confirm-btn:hover .channel-confirm-label |
| 31 | `v107-screen1-gap-normalize` | 12434-12457 | 5 | 7 | 間距版面 | html body #screen-1.screen.active、html body #screen-1 > :is(.page-title-strip,.input-setup-stack,.card,.actions-row,.inline-analytics-banner,.page-head,.page-top-banner,.analytics-hero-panel-compact)、html body #screen-1 > .input-setup-stack、html body #screen-1 .input-setup-stack > .input-setup-row、html body #screen-1 .input-setup-stack > .input-setup-row + .input-setup-row |
| 32 | `v131-document-center-style` | 12460-12490 | 41 | 1 | 配色、間距版面 | .doc-center-wrap、.doc-center-toggle、.doc-center-toggle:hover、.doc-center-toggle:focus-visible、.doc-center-toggle svg |
| 33 | `v136-hide-api-modal-redboxes` | 12493-12497 | 3 | 3 | 配色、元件外觀 | html body #api-modal #modal-current-mode、html body #api-modal .modal-foot > .btn.btn-secondary[onclick="clearApiKey()"]、html body #api-modal .modal-foot |
| 34 | `v220-unified-flow-navigator` | 12499-12634 | 25 | 82 | 配色 | html body .stepper、html body .flow-sidebar、html body .flow-sidebar-title、html body .flow-nav-track、html body .flow-nav-item |
| 35 | `v132-delivery-summary-clean` | 12636-12847 | 32 | 0 | 配色 | .v132-summary-grid、.v132-summary-card、.v132-summary-card:hover、.v132-summary-card--highlight、.v132-summary-icon |
| 36 | `a11y-audit-fix-2026-07-15` | 12848-12896 | 3 | 11 | bug修正 | :is(.selectable-card,.scenario-card,.goal-btn,.persona-btn,.provider-tab-btn,.tab-btn,
    .channel-check-item,button,a,[role="button"],[role="tab"],
    input.form-ctrl,select.form-ctrl,textarea.form-ctrl):focus-visible、:is(.comp-card-source,.comp-card-row,.comp-card-gap,.ref-meta,.scenario-metric-label,
    .scenario-tag,.badge,.search-badge,.experiment-score,small,
    .form-hint,.gdesc)、html body :is(#screen-1,#screen-2,#screen-3,#screen-4) :is(.compact-note.static-note p,.compact-note.static-note p:hover,.compact-note.static-note p:focus-within)、html body :is(.compact-note.static-note p,.compact-note.static-note p:hover,.compact-note.static-note p:focus-within) |
| 37 | `final-flow-nav-no-hover-invert-20260703` | 21088-21202 | 9 | 55 | 配色、互動狀態、強制覆蓋層 | html body .flow-sidebar .flow-nav-item、html body .flow-sidebar .flow-nav-item:hover、html body .flow-sidebar .flow-nav-item:focus、html body .flow-sidebar .flow-nav-item:focus-visible、html body .flow-sidebar .flow-nav-item:focus-within |
| 38 | `final-predictive-red-text-lock-20260703` | 21203-21238 | 2 | 14 | 配色、文字可讀性、強制覆蓋層 | html body #screen-2 .insight-predict .scenario-metric-label、html body #screen-2 .insight-predict .scenario-metric > span、html body #screen-2 .insight-predict .scenario-card:hover .scenario-metric-label、html body #screen-2 .insight-predict .scenario-card:hover .scenario-metric > span、html body #screen-2 .insight-predict .scenario-card:focus-within .scenario-metric-label |
| 39 | `final-funnel-text-white-lock-20260703` | 21239-21282 | 4 | 18 | 配色、文字可讀性、強制覆蓋層 | html body #analysis-desc-card .desc-funnel-panel .desc-funnel-stage、html body #analysis-desc-card .desc-funnel-panel .desc-funnel-stage:hover、html body #analysis-desc-card .desc-funnel-panel .desc-funnel-stage:focus、html body #analysis-desc-card .desc-funnel-panel:hover .desc-funnel-stage、html body #analysis-desc-card .desc-funnel-panel .desc-funnel-stage * |
| 40 | `final-screen3-output-no-invert-20260703` | 21283-21377 | 6 | 49 | 配色、強制覆蓋層 | html body #screen-3 .tab-line、html body #screen-3 .tab-line:hover、html body #screen-3 .tab-line:focus、html body #screen-3 .tab-line:focus-within、html body #screen-3 .card:hover .tab-line |
| 41 | `final-screen3-prompt-no-invert-20260703` | 21378-21491 | 5 | 40 | 配色、強制覆蓋層 | html body #screen-3 #out-prompt、html body #screen-3 #out-prompt:hover、html body #screen-3 #out-prompt:focus-within、html body #screen-3 #out-prompt-lib、html body #screen-3 #out-prompt-lib:hover |
| 42 | `final-competitor-red-lock-20260703` | 21492-21532 | 2 | 22 | 配色、強制覆蓋層 | html body #analysis-desc-card .sub-block-title .comp-count-title、html body #analysis-desc-card .sub-block-title:hover .comp-count-title、html body #analysis-desc-card .sub-block-title:focus .comp-count-title、html body #analysis-desc-card .sub-block-title:focus-within .comp-count-title、html body #analysis-desc-card:hover .sub-block-title .comp-count-title |
| 43 | `final-funnel-separated-captions-20260703` | 21533-21643 | 9 | 61 | 配色、強制覆蓋層 | html body #analysis-desc-card .desc-funnel-panel .desc-funnel-stage、html body #analysis-desc-card .desc-funnel-panel .desc-funnel-stage:hover、html body #analysis-desc-card .desc-funnel-panel .desc-funnel-stage:focus、html body #analysis-desc-card .desc-funnel-panel:hover .desc-funnel-stage、html body #analysis-desc-card .desc-funnel-panel .desc-funnel-stage * |
| 44 | `final-api-gateway-no-hover-invert-20260703` | 21644-21757 | 8 | 64 | 配色、互動狀態、強制覆蓋層 | html body #api-pill、html body #api-pill:hover、html body #api-pill:focus、html body #api-pill:focus-visible、html body #api-pill.on |
| 45 | `final-competitor-heading-colors-20260703` | 21758-21815 | 3 | 31 | 配色、強制覆蓋層 | html body #analysis-desc-card .sub-block-title .comp-count-title、html body #analysis-desc-card .sub-block-title:hover .comp-count-title、html body #analysis-desc-card .sub-block-title:focus .comp-count-title、html body #analysis-desc-card .sub-block-title:focus-within .comp-count-title、html body #analysis-desc-card:hover .sub-block-title .comp-count-title |
| 46 | `final-output-chart-text-double-20260704` | 21816-21868 | 6 | 27 | 配色、文字可讀性、強制覆蓋層 | html body #screen-3 #out-chart .two-col > div > div:first-child、html body #screen-3 #out-chart > div[style*="margin-top"] > div:first-child、html body #screen-3 #out-chart .chart-legend-note、html body #screen-3 #out-chart .chart-legend-note:hover、html body #screen-3 #out-chart .chart-legend-note:focus |
| 47 | `final-scenario-tag-equal-height-20260704` | 21869-21931 | 6 | 36 | 配色、強制覆蓋層 | html body #screen-2 #scenario-grid、html body #screen-2 #scenario-grid .scenario-card、html body #screen-2 #scenario-grid .scenario-card .scenario-tag、html body #screen-2 #scenario-grid .scenario-card:hover .scenario-tag、html body #screen-2 #scenario-grid .scenario-card:focus-within .scenario-tag |
| 48 | `final-api-gateway-modal-complete-lock-20260703` | 21932-22119 | 13 | 92 | 配色、強制覆蓋層、元件外觀 | html body #api-modal、html body #api-modal:hover、html body #api-modal:focus、html body #api-modal:focus-within、html body #api-modal .modal-box |
| 49 | `final-api-gateway-modal-full-lock-20260704` | 22120-22480 | 28 | 171 | 配色、強制覆蓋層、元件外觀 | html body #api-modal、html body #api-modal.open、html body #api-modal:hover、html body #api-modal:focus、html body #api-modal:focus-within |
| 50 | `final-competitor-label-and-title-lock-20260704` | 22481-22525 | 2 | 22 | 配色、文字可讀性、強制覆蓋層 | html body #analysis-desc-card .comp-group-label、html body #analysis-desc-card .comp-group-label:hover、html body #analysis-desc-card .comp-group-label:focus、html body #analysis-desc-card .comp-group-label:focus-visible、html body #analysis-desc-card .comp-group-label:active |
| 51 | `final-screen3-tabline-light-blue-20260704` | 22526-22541 | 1 | 7 | 配色、強制覆蓋層 | html body #screen-3 .tab-line、html body #screen-3 .tab-line:hover、html body #screen-3 .tab-line:focus、html body #screen-3 .tab-line:focus-within、html body #screen-3 .card:hover .tab-line |
| 52 | `final-experiment-score-title-red-20260705` | 22542-22574 | 1 | 24 | 配色、文字可讀性、強制覆蓋層 | html body #screen-3 #out-experiment .experiment-card .experiment-score、html body #screen-3 #out-experiment .experiment-card .experiment-score:hover、html body #screen-3 #out-experiment .experiment-card:hover .experiment-score、html body #screen-3 #out-experiment .experiment-card:focus-within .experiment-score、html body #screen-3 #out-experiment:hover .experiment-card .experiment-score |
| 53 | `final-experiment-blue-mark-text-red-20260705` | 22575-22599 | 1 | 6 | 配色、文字可讀性、強制覆蓋層 | html body #screen-3 #out-experiment .experiment-card .experiment-score、html body #screen-3 #out-experiment .experiment-card .experiment-score:hover、html body #screen-3 #out-experiment .experiment-card:hover .experiment-score、html body #screen-3 #out-experiment .experiment-card:focus-within .experiment-score、html body #screen-3 #out-experiment .experiment-timeline .timeline-card |
| 54 | `final-screen2-hero-copy-20260705` | 22600-22615 | 2 | 6 | 強制覆蓋層 | html body #screen-2 .page-top-banner h2、html body #screen-2 .page-top-banner h2:hover、html body #screen-2 .page-top-banner:hover h2、html body #screen-2 .page-top-banner p、html body #screen-2 .page-top-banner p:hover |
| 55 | `final-experiment-aligned-frames-20260705` | 22616-22746 | 16 | 85 | 配色、間距版面、強制覆蓋層 | html body #screen-3 #out-experiment .experiment-grid、html body #screen-3 #out-experiment .experiment-card、html body #screen-3 #out-experiment .experiment-card:hover、html body #screen-3 #out-experiment .experiment-card:focus-within、html body #screen-3 #out-experiment .experiment-card-head |
| 56 | `final-experiment-score-red-timeline-black-20260705` | 22747-22781 | 2 | 15 | 配色、強制覆蓋層 | html body #screen-3 #out-experiment .experiment-card .experiment-score、html body #screen-3 #out-experiment .experiment-card .experiment-score *、html body #screen-3 #out-experiment .experiment-card .experiment-score:hover、html body #screen-3 #out-experiment .experiment-card .experiment-score:hover *、html body #screen-3 #out-experiment .experiment-card:hover .experiment-score |
| 57 | `experiment-plan-card-layout-fix-20260706` | 22782-22997 | 26 | 168 | 配色、bug修正、元件外觀 | html body #screen-3 #out-experiment .experiment-grid、html body #screen-3 #out-experiment .experiment-card-clean、html body #screen-3 #out-experiment .experiment-card-clean:hover、html body #screen-3 #out-experiment .experiment-card-clean:focus-within、html body #screen-3 #out-experiment .experiment-card-clean * |
| 58 | `experiment-plan-text-fit-final-20260706-2318` | 23002-23111 | 21 | 64 | 配色、文字可讀性、強制覆蓋層 | html body #screen-3 #out-experiment .experiment-question-clean、html body #screen-3 #out-experiment .experiment-question-clean:hover、html body #screen-3 #out-experiment .experiment-question-clean:focus-within、html body #screen-3 #out-experiment .experiment-question-clean p、html body #screen-3 #out-experiment .experiment-card:hover .experiment-question-clean p |
| 59 | `experiment-kpi-alignment-wrap-fix-clean-20260706-2350` | 23113-23227 | 17 | 87 | 配色、間距版面、bug修正 | html body #screen-3 #out-experiment .experiment-metric-row-clean:nth-child(3)、html body #screen-3 #out-experiment .experiment-metric-row-clean:nth-child(3):hover、html body #screen-3 #out-experiment .experiment-metric-row-clean:nth-child(3):focus-within、html body #screen-3 #out-experiment .experiment-metric-row-clean:nth-child(3) > span、html body #screen-3 #out-experiment .experiment-metric-row-clean:nth-child(3) > b |
| 60 | `v28-experiment-orange-no-hover-jump-hard-lock` | 23229-23417 | 11 | 95 | 配色、互動狀態、強制覆蓋層 | html body #screen-3 #out-experiment .experiment-card、html body #screen-3 #out-experiment .experiment-card:hover、html body #screen-3 #out-experiment .experiment-card:focus、html body #screen-3 #out-experiment .experiment-card:focus-within、html body #screen-3 #out-experiment .experiment-card-clean |
| 61 | `v29-experiment-question-term-no-resize-lock` | 23419-23500 | 4 | 44 | 強制覆蓋層 | html body #screen-3 #out-experiment .experiment-question-clean、html body #screen-3 #out-experiment .experiment-question-clean:hover、html body #screen-3 #out-experiment .experiment-question-clean:focus、html body #screen-3 #out-experiment .experiment-question-clean:focus-within、html body #screen-3 #out-experiment .experiment-card:hover .experiment-question-clean |
| 62 | `v42-strategy-image-scale-down-more` | 23501-23517 | 2 | 10 | 待人工分類 | html body #screen-2 .page-top-banner .banner-analytics.ai-engine-visual、html body #screen-2 .page-top-banner .banner-analytics.ai-engine-visual img |
| 63 | `v47-strategy-image-fill-right-column` | 23522-23598 | 7 | 44 | 待人工分類 | html body #screen-2 > .page-top-banner、html body #screen-2 .page-top-banner、html body #screen-2 > .page-top-banner > div:first-child、html body #screen-2 .page-top-banner > div:first-child、html body #screen-2 > .page-top-banner .banner-analytics.ai-engine-visual |
| 64 | `v60-remove-ms-from-logo` | 23601-23613 | 2 | 6 | 配色 | .brand-mark、.brand-mark img |
| 65 | `v65-api-modal-dark-note-safe-css-only` | 23616-23670 | 3 | 29 | 配色、元件外觀 | html body #api-modal .modal-box .api-modal-dark-note、html body #api-modal .modal-box .api-modal-dark-note:hover、html body #api-modal .modal-box .api-modal-dark-note:focus、html body #api-modal .modal-box .api-modal-dark-note:focus-within、html body #api-modal .modal-box .api-modal-dark-note:active |
| 66 | `v70-experiment-title-spacing-english-normal` | 23673-23696 | 3 | 8 | 間距版面、文字可讀性 | html body #screen-3 .short-kicker.experiment-plan-title-clean、html body #screen-3 #out-experiment .short-kicker.experiment-plan-title-clean、html body #screen-3 .short-kicker.experiment-plan-title-clean::first-line、html body #screen-3 #out-experiment .short-kicker.experiment-plan-title-clean::first-line、html body #screen-3 .experiment-title-en |
| 67 | `v72-output-tabs-font-size-up` | 23701-23730 | 3 | 3 | 字型 | html body #screen-3 #out-copy、html body #screen-3 #out-copy *、html body #screen-3 #out-image、html body #screen-3 #out-image *、html body #screen-3 #out-prompt |
| 68 | `v73-experiment-red-tabs-font-adjust` | 23733-23774 | 4 | 5 | 配色、字型 | html body #screen-3 .tab-btn[data-tab="experiment"]、html body #screen-3 .tab-btn[data-tab="experiment"] *、html body #screen-3 #out-experiment .short-kicker、html body #screen-3 #out-experiment .short-kicker *、html body #screen-3 #experiment-timeline .timeline-card b |
| 69 | `v74-experiment-and-tabs-font-minus-005` | 23777-23842 | 7 | 10 | 配色、字型 | html body #screen-3 #out-experiment、html body #screen-3 #out-experiment *、html body #screen-3 #out-experiment * *、html body #screen-3 .tab-btn[data-tab="experiment"]、html body #screen-3 .tab-btn[data-tab="experiment"]:hover |
| 70 | `v76-api-pill-no-hover-invert-stable` | 23845-23947 | 6 | 38 | 配色、互動狀態、元件外觀 | html body header #api-pill、html body header #api-pill:hover、html body header #api-pill:focus、html body header #api-pill:focus-visible、html body header #api-pill:active |
| 71 | `v77-day-title-red-runtime-lock` | 23950-23962 | 1 | 4 | 配色、文字可讀性、強制覆蓋層 | html body #screen-3 #experiment-timeline b.timeline-day-red、html body #screen-3 #experiment-timeline .timeline-card b.timeline-day-red、html body #screen-3 #out-experiment .experiment-timeline .timeline-card b.timeline-day-red、html body #screen-3 #out-experiment .experiment-timeline .timeline-card:hover b.timeline-day-red、html body #screen-3 #out-experiment .experiment-timeline .timeline-card:focus-within b.timeline-day-red |
| 72 | `v79-day-red-no-garbled-safe` | 23963-23977 | 1 | 6 | 配色、bug修正 | html body #screen-3 #experiment-timeline .timeline-card b.timeline-day-red-lock、html body #screen-3 #experiment-timeline .timeline-card:hover b.timeline-day-red-lock、html body #screen-3 #experiment-timeline .timeline-card:focus-within b.timeline-day-red-lock、html body #screen-3 #out-experiment .experiment-timeline .timeline-card b.timeline-day-red-lock、html body #screen-3 #out-experiment .experiment-timeline .timeline-card:hover b.timeline-day-red-lock |
| 73 | `v90-benchmark-section-frames` | 23978-24031 | 9 | 7 | 待人工分類 | #out-benchmark #benchmark-tables、#out-benchmark .bench-freshness-banner、#out-benchmark .bench-section、#out-benchmark .bench-section h4、#out-benchmark .bench-section > div[style*="overflow-x:auto"] |
| 74 | `leadgen-styles` | 24033-24051 | 7 | 0 | 配色 | #out-leadgen .lead-tag、#out-leadgen .lead-tag-high、#out-leadgen .lead-tag-mid、#out-leadgen .lead-tag-low、#out-leadgen .lead-table th |
| 75 | `v91-copy-tab-darker-and-copy-text-larger` | 24055-24106 | 5 | 14 | 配色、文字可讀性 | html body #screen-3 #out-copy .copy-variant-tabs、html body #screen-3 #out-copy .copy-type-tabs、html body #screen-3 #out-copy .copy-tabs、html body #screen-3 #out-copy .copy-tab-line、html body #screen-3 #out-copy .copy-filter-row |
| 76 | `v92-copy-tab-bg-darker` | 24109-24134 | 2 | 7 | 配色 | html body #screen-3 #out-copy .copy-variant-tabs、html body #screen-3 #out-copy .copy-type-tabs、html body #screen-3 #out-copy .copy-tabs、html body #screen-3 #out-copy .copy-tab-line、html body #screen-3 #out-copy .copy-filter-row |
| 77 | `v93-copy-persona-area-darker-force` | 24137-24182 | 4 | 28 | 配色、強制覆蓋層 | html body #screen-3 #out-copy .persona-sel、html body #screen-3 #out-copy #persona-sel、html body #screen-3 #out-copy .persona-btn、html body #screen-3 #out-copy .persona-btn:hover、html body #screen-3 #out-copy .persona-btn:focus |
| 78 | `v97-prompt-title-strong` | 24183-24195 | 1 | 6 | 配色、文字可讀性 | html body #screen-3 #out-prompt .prompt-title-strong、html body #screen-3 #out-prompt .prompt-title-strong:hover、html body #screen-3 #out-prompt .prompt-title-strong:focus |
| 79 | `v99-strategy-note-title-larger` | 24198-24208 | 1 | 3 | 文字可讀性 | html body #screen-3 #out-prompt-lib .static-note-title、html body #screen-3 #out-prompt-lib .static-note-title:hover、html body #screen-3 #out-prompt-lib .compact-note .static-note-title、html body #screen-3 #out-prompt-lib .compact-note .static-note-title:hover |
| 80 | `v102-start-analysis-button-font-larger` | 24210-24224 | 1 | 3 | 字型 | html body #analyze-btn、html body #analyze-btn:hover、html body #analyze-btn:focus、html body #analyze-btn:active、html body button#analyze-btn |
| 81 | `v103-experiment-title-en-black` | 24227-24238 | 1 | 4 | 配色、文字可讀性 | html body #screen-3 #out-experiment .experiment-title-en、html body #screen-3 #out-experiment .experiment-title-en:hover、html body #screen-3 #out-experiment .short-kicker.experiment-plan-title-clean .experiment-title-en、html body #screen-3 #out-experiment .short-kicker.experiment-plan-title-clean:hover .experiment-title-en |
| 82 | `v105_header_width_and_title_weight` | 24239-24276 | 4 | 13 | 文字可讀性 | html body .top-header、html body .top-header-inner、html body .top-header > .top-header-inner、html body .top-header .top-header-inner、html body .brand-text-title |
| 83 | `v108_final_text_size_delivery_hover_fixes` | 24279-24301 | 2 | 6 | 互動狀態、文字可讀性、強制覆蓋層、bug修正 | html body #screen-3 #out-prompt-lib .prompt-lib-section-title、html body #screen-3 #out-prompt-lib .prompt-lib-section-title:hover、html body #screen-3 #out-prompt-lib .prompt-lib-section-title:focus、html body #screen-3 #out-prompt-lib .compact-note.static-note .static-note-title、html body #screen-3 #out-prompt-lib .compact-note.static-note:hover .static-note-title |
| 84 | `v109-day-labels-always-red` | 24304-24318 | 1 | 7 | 配色、文字可讀性 | html body #screen-3 #out-experiment .experiment-timeline .timeline-card b.timeline-day-red、html body #screen-3 #out-experiment .experiment-timeline .timeline-card:hover b.timeline-day-red、html body #screen-3 #out-experiment .experiment-timeline .timeline-card:focus-within b.timeline-day-red、html body #screen-3 #out-experiment:hover .experiment-timeline .timeline-card b.timeline-day-red |
| 85 | `v110_force_requested_text_fixes` | 24366-24398 | 3 | 11 | 文字可讀性、強制覆蓋層、bug修正 | html body #screen-3 #out-experiment .experiment-title-en、html body #screen-3 #out-prompt-lib .prompt-lib-section-title、html body #screen-3 #out-prompt-lib .prompt-lib-section-title:hover、html body #screen-3 #out-prompt-lib .prompt-lib-section-title:focus、html body #screen-3 #out-prompt-lib .prompt-lib-context-title |
| 86 | `v112_experiment_no_hover_jump_text_110pct` | 24399-24469 | 6 | 20 | 配色、互動狀態、文字可讀性 | html body #screen-3 #out-experiment、html body #screen-3 #out-experiment:hover、html body #screen-3 #out-experiment:focus-within、html body #screen-3 #out-experiment *、html body #screen-3 #out-experiment:hover * |
| 87 | `v113_strategy_note_title_110pct` | 24470-24480 | 1 | 3 | 文字可讀性 | html body #screen-3 #out-prompt-lib .strategy-note-title-force、html body #screen-3 #out-prompt-lib .compact-note.static-note > b.static-note-title.strategy-note-title-force、html body #screen-3 #out-prompt-lib .compact-note.static-note .static-note-title.strategy-note-title-force、html body #screen-3 #out-prompt-lib .compact-note.static-note:hover .static-note-title.strategy-note-title-force |
| 88 | `v114_framed_text_110pct` | 24513-24547 | 6 | 11 | 文字可讀性 | html body #screen-2 #env-factor-list .env-factor .env-factor-title、html body #screen-2 #env-factor-list .env-factor .env-rank、html body #screen-2 #env-factor-list .env-factor .env-row、html body #screen-2 #env-factor-list .env-factor .env-row b、html body #screen-2 #env-factor-list .env-factor .inline-expand |
| 89 | `v119_output_tabs_no_text_jump` | 24592-24629 | 2 | 19 | 互動狀態、文字可讀性 | html body #screen-3 .tab-line .tab-btn、html body #screen-3 .tab-line .tab-btn:hover、html body #screen-3 .tab-line .tab-btn:focus、html body #screen-3 .tab-line .tab-btn:focus-visible、html body #screen-3 .tab-line .tab-btn:focus-within |
| 90 | `v120_experiment_tab_no_enlarge` | 24632-24654 | 1 | 11 | 待人工分類 | html body #screen-3 .tab-line .tab-btn[onclick*="out-experiment"]、html body #screen-3 .tab-line .tab-btn[onclick*="out-experiment"]:hover、html body #screen-3 .tab-line .tab-btn[onclick*="out-experiment"]:focus、html body #screen-3 .tab-line .tab-btn[onclick*="out-experiment"]:focus-visible、html body #screen-3 .tab-line .tab-btn[onclick*="out-experiment"]:focus-within |
| 91 | `v121-benchmark-title-kpi-only` | 24655-24667 | 1 | 6 | 配色、文字可讀性 | html body #screen-3 #out-benchmark .benchmark-title-strong、html body #screen-3 #out-benchmark .benchmark-title-strong:hover、html body #screen-3 #out-benchmark .benchmark-title-strong:focus |
| 92 | `v122-day-labels-source-red-lock` | 24702-24719 | 1 | 6 | 配色、文字可讀性、強制覆蓋層 | html body #screen-3 #out-experiment .experiment-timeline .timeline-card b.timeline-day-red、html body #screen-3 #out-experiment .experiment-timeline .timeline-card b.timeline-day-red-lock、html body #screen-3 #out-experiment .experiment-timeline .timeline-card:hover b.timeline-day-red、html body #screen-3 #out-experiment .experiment-timeline .timeline-card:hover b.timeline-day-red-lock、html body #screen-3 #out-experiment .experiment-timeline .timeline-card:focus-within b.timeline-day-red |
| 93 | `v124-cross-platform-mac-windows` | 24720-24836 | 15 | 3 | 配色、跨裝置相容 | html、body、button、input、textarea |
| 94 | `v169-windows-experiment-kpi-overlap-fix` | 25182-25297 | 14 | 53 | 間距版面、跨裝置相容、bug修正 | html body #screen-3 #out-experiment .experiment-metric-row-clean、html body #screen-3 #out-experiment .experiment-metric-row-clean:hover、html body #screen-3 #out-experiment .experiment-metric-row-clean:focus-within、html body #screen-3 #out-experiment .experiment-metric-row-clean > span、html body #screen-3 #out-experiment .experiment-metric-row-clean > b |
| 95 | `v190-doc-center-stable-no-layout-break` | 25343-25584 | 24 | 148 | 配色、間距版面 | html body .flow-nav-item.active、html body .flow-nav-item.active :is(b,strong,span)、html body .flow-nav-item.active small、html body .flow-nav-item.active .flow-nav-index、html body .flow-nav-index |
| 96 | `v193-manual-pdf-real-file-download` | 25683-25699 | 2 | 2 | 待人工分類 | #doc-center-panel .doc-file-actions > a.doc-action-btn、#doc-center-panel a.doc-action-btn[id^="doc-download"]、#doc-center-panel .doc-download-inline-text、#doc-center-panel .doc-file-actions > a.doc-action-btn:hover、#doc-center-panel a.doc-action-btn[id^="doc-download"]:hover |
| 97 | `v230-api-setting-label` | 25812-25814 | 0 | 0 | 文字可讀性 | (無明確選擇器) |
| 98 | `v231-center-workflow-tagline` | 25843-25873 | 3 | 11 | 間距版面 | html body .top-header-inner、html body .top-header-inner .top-tagline > .tagline-text、html body .top-header-inner .top-tagline |
| 99 | `v234-hide-api-optional-text` | 25962-25973 | 1 | 6 | 文字可讀性 | html body .api-optional-hidden、html body .api-optional-hidden * |
| 100 | `v236-manual-download-final-stable` | 26028-26180 | 7 | 103 | 配色、強制覆蓋層 | html body #doc-center-panel *、html body #doc-center-panel *:hover、html body #doc-center-panel *:focus、html body #doc-center-panel *:active、html body #doc-center-panel .doc-file-actions |
| 101 | `v242-remove-experiment-click-jump` | 26183-26310 | 7 | 52 | 配色、互動狀態 | html body #screen-3 #out-experiment、html body #screen-3 #out-experiment *、html body #screen-3 #experiment-grid、html body #screen-3 #experiment-grid *、html body #screen-3 #experiment-timeline |
| 102 | `v243-experiment-title-indent-two-spaces` | 26313-26318 | 1 | 1 | 文字可讀性 | html body #screen-3 #out-experiment .experiment-plan-title-clean |
| 103 | `v244-timeline-note-text-minus015` | 26357-26411 | 4 | 24 | 文字可讀性 | html body #screen-3 #out-experiment #experiment-timeline .timeline-card b、html body #screen-3 #out-experiment #experiment-timeline .timeline-card b:hover、html body #screen-3 #out-experiment .experiment-timeline .timeline-card b、html body #screen-3 #out-experiment .experiment-timeline .timeline-card b:hover、html body #screen-3 #out-experiment #experiment-timeline .timeline-card span |
| 104 | `v245-timeline-note-text-bold` | 26470-26504 | 2 | 10 | 文字可讀性 | html body #screen-3 #out-experiment #experiment-timeline .timeline-card b、html body #screen-3 #out-experiment #experiment-timeline .timeline-card span、html body #screen-3 #out-experiment .experiment-timeline .timeline-card b、html body #screen-3 #out-experiment .experiment-timeline .timeline-card span、html body #screen-3 #out-experiment #experiment-timeline .timeline-card b:hover |
| 105 | `v246-action-steps-wrap-inside-frame` | 26558-26652 | 6 | 59 | 待人工分類 | html body #screen-3 #out-experiment .experiment-action-box-clean、html body #screen-3 #out-experiment .experiment-action-box-clean:hover、html body #screen-3 #out-experiment .experiment-action-box-clean:focus、html body #screen-3 #out-experiment .experiment-action-box-clean:active、html body #screen-3 #out-experiment .experiment-action-box-clean ol |
| 106 | `v247-term-note-baseline-align` | 26736-26808 | 4 | 44 | 間距版面 | html body #screen-3 #out-experiment .experiment-question-clean .term-wrap、html body #screen-3 #out-experiment .experiment-question-clean .term-wrap:hover、html body #screen-3 #out-experiment .experiment-metric-row-clean .term-wrap、html body #screen-3 #out-experiment .experiment-metric-row-clean .term-wrap:hover、html body #screen-3 #out-experiment .experiment-question-clean .term-wrap > span:first-child |
| 107 | `v248-v252-styles` | 26878-26901 | 22 | 8 | 配色 | .v25x-card、.v25x-card h4、.v25x-badge、.v25x-badge.ok、.v25x-badge.warn |
| 108 | `v260-four-tabs-kicker-banner-and-button-hover-lock` | 27380-27510 | 13 | 47 | 配色、互動狀態、強制覆蓋層 | html body #screen-3 #out-safety .short-kicker.prompt-title-strong、html body #screen-3 #out-attribution .short-kicker.prompt-title-strong、html body #screen-3 #out-cfo-roi .short-kicker.prompt-title-strong、html body #screen-3 #out-leadgen .short-kicker.prompt-title-strong、html body #screen-3 #out-safety .short-kicker.prompt-title-strong::before |
| 109 | `v261-mobile-tab-line-wrap-fix` | 27512-27545 | 7 | 12 | 跨裝置相容、bug修正 | html body #screen-3 .tab-line、html body #screen-3 .tab-line .tab-btn、html body #screen-3 .tab-line::-webkit-scrollbar、html body #screen-3 .tab-line::-webkit-scrollbar-thumb |
| 110 | `v262-unify-all-ten-tabs-style` | 27547-27590 | 3 | 16 | 配色 | html body #screen-3 .tab-line .tab-btn:not(.active)[aria-controls]、html body #screen-3 .tab-line .tab-btn:not(.active)[aria-controls]:hover、html body #screen-3 .tab-line .tab-btn:not(.active)[aria-controls]:focus、html body #screen-3 .tab-line .tab-btn:not(.active)[aria-controls]:focus-visible、html body #screen-3 .tab-line .tab-btn:not(.active)[aria-controls]:focus-within |
| 111 | `v18-4-master-ui-and-features-patch` | 27606-27638 | 4 | 13 | 配色 | html body #screen-3 #out-experiment .experiment-plan-title-clean、html body .day-title-bright-red、html body .v208-title-outer-border-darkred、html body .btn、html body .tab-btn |

## B. Script 補丁清單（共 30 個，依套用順序）

| # | id | 行號 | 字元數 | IIFE獨立作用域 | 有DOMContentLoaded | 分類 | 主要函式 |
|---|---|---|---|---|---|---|---|
| 1 | `v109-day-labels-always-red-script` | 24319-24363 | 1509 | 是 | 是 | 動態改樣式、頁面初始化 | isDayLabel、lockDayLabelsRed |
| 2 | `v113_strategy_note_title_110pct-script` | 24482-24510 | 965 | 是 | 是 | 動態改樣式、頁面初始化 | fixStrategyNoteTitle |
| 3 | `v114_framed_text_110pct-script` | 24549-24590 | 2415 | 是 | 是 | 動態改樣式、頁面初始化 | applyFramedTextScale |
| 4 | `v121-benchmark-title-kpi-only-script` | 24669-24699 | 965 | 是 | 是 | 基準資料、動態改樣式、頁面初始化 | fixBenchmarkTitle |
| 5 | `v131-document-center-script` | 24839-24889 | 1739 | 是 | 否 | 動態改樣式 | byId、panel、toggleBtn、setOpen |
| 6 | `v124-cross-platform-mac-windows-script` | 24892-24900 | 264 | 是 | 否 | 待人工分類 | (無具名函式) |
| 7 | `v157-current-signal-help-title-and-spacing-js` | 24901-24942 | 1898 | 是 | 是 | 動態改樣式、頁面初始化 | forceCurrentSignalHelpV157 |
| 8 | `v164-current-signal-gap-half-and-dot-js` | 24943-24996 | 2182 | 是 | 是 | 動態改樣式、頁面初始化 | applyV164SignalHelp |
| 9 | `v165-brand-fonts-taipei-dunbar-js` | 24999-25041 | 1826 | 是 | 是 | 動態改樣式、頁面初始化 | applyV165BrandFonts |
| 10 | `v167-cross-platform-compatibility-js` | 25044-25139 | 3902 | 是 | 是 | 動態改樣式、頁面初始化 | applyCrossPlatformCompatibility |
| 11 | `v168-windows-select-dropdown-fix-js` | 25142-25179 | 1326 | 是 | 是 | 動態改樣式、頁面初始化 | fixWindowsSelectDropdown |
| 12 | `v172-channel-confirm-text-graywhite-js` | 25298-25340 | 1464 | 是 | 是 | 動態改樣式、頁面初始化 | applyChannelConfirmTextGrayWhite |
| 13 | `v190-doc-center-stable-no-layout-break-js` | 25586-25681 | 3273 | 是 | 是 | 動態改樣式、頁面初始化 | applyV190、runV190 |
| 14 | `v193-manual-pdf-real-file-download-js` | 25701-25780 | 1189704 | 是 | 是 | 頁面初始化 | base64ToBlob、applyManualDownloadRealFile |
| 15 | `v196-restore-v193-layout-label-spacing-js` | 25783-25809 | 811 | 是 | 是 | 頁面初始化 | fixCompanyIndustryLabel |
| 16 | `v230-api-setting-label-js` | 25815-25840 | 867 | 是 | 是 | AI供應商相關、頁面初始化 | replaceApiGatewayLabelV230、runV230 |
| 17 | `v231-center-workflow-tagline-js` | 25875-25961 | 3224 | 是 | 是 | 動態改樣式、頁面初始化 | getTaglineEl、layoutWorkflowTaglineV231、runV231 |
| 18 | `v234-hide-api-optional-text-js` | 25975-26026 | 1473 | 是 | 是 | AI供應商相關、動態改樣式、頁面初始化 | hideApiOptionalTextV234、runV234 |
| 19 | `v243-experiment-title-indent-two-spaces-js` | 26320-26354 | 1143 | 是 | 是 | 動態改樣式、頁面初始化 | indentExperimentTitleV243、runV243 |
| 20 | `v244-timeline-note-text-minus015-js` | 26413-26467 | 2149 | 是 | 是 | 動態改樣式、頁面初始化 | shrinkTimelineNoteTextV244、runV244 |
| 21 | `v245-timeline-note-text-bold-js` | 26506-26555 | 1911 | 是 | 是 | 動態改樣式、頁面初始化 | boldTimelineNoteTextV245、runV245 |
| 22 | `v246-action-steps-wrap-inside-frame-js` | 26654-26733 | 3503 | 是 | 是 | 動態改樣式、頁面初始化 | wrapActionStepsV246、runV246 |
| 23 | `v247-term-note-baseline-align-js` | 26810-26870 | 2573 | 是 | 是 | 動態改樣式、頁面初始化 | alignTermNotesV247、runV247 |
| 24 | `v248-compliance-check` | 26903-26976 | 4253 | **否(需注意)** | 否 | 合規檢查 | stripHtmlTagsV248、scanComplianceText、buildComplianceScan、renderComplianceCheck |
| 25 | `v249-benchmark-freshness` | 26978-27044 | 3579 | **否(需注意)** | 否 | 基準資料 | daysBetweenV249、saveManualBenchmarkCheck、getCustomBenchmarkRowsV249、saveCustomBenchmarkRow |
| 26 | `v250-interactive-dashboard-export` | 27046-27253 | 11669 | **否(需注意)** | 否 | 匯出/圖表功能、動態改樣式 | buildInteractiveDashboardHtml、esc、showLayer、showPersona |
| 27 | `v251-voice-summary` | 27255-27317 | 2849 | **否(需注意)** | 否 | 語音功能、動態改樣式 | buildVoiceSummaryText、playVoiceSummary、stopVoiceSummary、downloadVoiceSummaryText |
| 28 | `v252-sensitivity-panel` | 27319-27378 | 3332 | **否(需注意)** | 否 | 分析面板功能 | computeSensitivityV252、renderSensitivityPanel、updateSensitivityV252 |
| 29 | `v260-window-blur-focus-reset` | 27592-27596 | 137 | **否(需注意)** | 否 | 視窗事件處理 | (無具名函式) |
| 30 | `v18-4-master-js-and-export-patch` | 27640-27716 | 2848 | 是 | 是 | 匯出/圖表功能、動態改樣式、頁面初始化 | (無具名函式) |

## C. 熱點選擇器（被4個以上不同補丁碰過，合併時風險最高）

| 選擇器 | 被幾個補丁碰過 | 相關補丁id |
|---|---|---|
| `.scenario-card` | 6 | `all-analysis-dashboard-force`、`analysis-chart-size-force`、`inlined-linear-modern-theme-for-ai-marketing2`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore`、`v124-cross-platform-mac-windows` |
| `.summary-card` | 6 | `all-analysis-dashboard-force`、`inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore`、`v124-cross-platform-mac-windows` |
| `.form-ctrl` | 6 | `global-hover-input-contrast-force`、`inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore`、`v124-cross-platform-mac-windows` |
| `.brand-mark` | 6 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore`、`v61-brand-mark-clean`、`v60-remove-ms-from-logo` |
| `.goal-btn.selected` | 5 | `global-hover-input-contrast-force`、`selected-card-dark-state-force`、`inlined-linear-modern-theme-for-ai-marketing2`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `html body #screen-3 .tab-line` | 5 | `global-final-readability-polish`、`codex-20260702-badge-image-fix`、`final-screen3-output-no-invert-20260703`、`final-screen3-tabline-light-blue-20260704`、`v261-mobile-tab-line-wrap-fix` |
| `html body #screen-1 .input-side-visual` | 5 | `global-final-readability-polish`、`live-final-20260701-night-polish`、`live-final-20260702-final-polish`、`live-final-20260702-gap-and-visibility-fix`、`codex-20260702-badge-image-fix` |
| `html` | 5 | `live-final-20260701-request-pass`、`inlined-linear-modern-theme-for-ai-marketing2`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore`、`v124-cross-platform-mac-windows` |
| `body` | 5 | `live-final-20260701-request-pass`、`inlined-linear-modern-theme-for-ai-marketing2`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore`、`v124-cross-platform-mac-windows` |
| `.card` | 5 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore`、`v124-cross-platform-mac-windows` |
| `.insight-card` | 5 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore`、`v124-cross-platform-mac-windows` |
| `html body #screen-3 #out-experiment .experiment-metric-row-clean` | 5 | `experiment-plan-card-layout-fix-20260706`、`experiment-plan-text-fit-final-20260706-2318`、`v28-experiment-orange-no-hover-jump-hard-lock`、`v169-windows-experiment-kpi-overlap-fix`、`v242-remove-experiment-click-jump` |
| `.mini-analytics` | 4 | `all-analysis-dashboard-force`、`analysis-chart-size-force`、`remove-decorative-mini-icons-force`、`inlined-non-generic-product-polish` |
| `.experiment-card` | 4 | `all-analysis-dashboard-force`、`analysis-chart-size-force`、`inlined-v11-dark-theme-restore`、`v124-cross-platform-mac-windows` |
| `.scenario-card::before` | 4 | `all-analysis-dashboard-force`、`inlined-linear-modern-theme-for-ai-marketing2`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.summary-card::before` | 4 | `all-analysis-dashboard-force`、`inlined-linear-modern-theme-for-ai-marketing2`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.analytics-hero-panel` | 4 | `all-analysis-dashboard-force`、`analysis-chart-size-force`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.inline-analytics-banner` | 4 | `all-analysis-dashboard-force`、`analysis-chart-size-force`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `#analysis-loading .analysis-percent` | 4 | `all-screens-chart-frame-force`、`analysis-progress-scale-force`、`global-final-readability-polish`、`inlined-v11-dark-theme-restore` |
| `.persona-btn.selected` | 4 | `global-hover-input-contrast-force`、`inlined-linear-modern-theme-for-ai-marketing2`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.provider-tab-btn.active` | 4 | `global-hover-input-contrast-force`、`inlined-linear-modern-theme-for-ai-marketing2`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.tab-btn.active` | 4 | `global-hover-input-contrast-force`、`inlined-linear-modern-theme-for-ai-marketing2`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.step-circle` | 4 | `global-hover-input-contrast-force`、`inlined-linear-modern-theme-for-ai-marketing2`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.goal-btn .gicon` | 4 | `global-hover-input-contrast-force`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.alyz-step` | 4 | `visual-contrast-balance-force`、`inlined-linear-modern-theme-for-ai-marketing2`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `html body #screen-1 .input-side-visual img` | 4 | `global-final-readability-polish`、`live-final-20260701-night-polish`、`live-final-20260702-final-polish`、`codex-20260702-badge-image-fix` |
| `html body .page-title-strip` | 4 | `global-final-readability-polish`、`live-final-20260701-night-polish`、`live-final-20260702-final-polish`、`live-final-20260702-gap-and-visibility-fix` |
| `html body #analysis-loading .analysis-percent` | 4 | `global-final-readability-polish`、`live-final-20260702-final-polish`、`live-final-20260702-gap-and-visibility-fix`、`codex-20260702-badge-image-fix` |
| `html body #analysis-loading .analysis-percent-value` | 4 | `global-final-readability-polish`、`live-final-20260702-final-polish`、`live-final-20260702-gap-and-visibility-fix`、`codex-20260702-badge-image-fix` |
| `:root` | 4 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.top-header` | 4 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.brand-text-title` | 4 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.brand-text-sub` | 4 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.tagline-text` | 4 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.stepper` | 4 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.card-title` | 4 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.card-title .num` | 4 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.num` | 4 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.form-label` | 4 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.goal-btn` | 4 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.goal-btn .gname` | 4 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.btn-primary` | 4 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.btn-success` | 4 | `inlined-linear-modern-theme-for-ai-marketing2`、`inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore` |
| `.brand-mark::before` | 4 | `inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore`、`v61-brand-mark-clean` |
| `.tab-btn` | 4 | `inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore`、`v124-cross-platform-mac-windows` |
| `.done-box` | 4 | `inlined-enterprise-saas-polish`、`inlined-non-generic-product-polish`、`inlined-v11-dark-theme-restore`、`v124-cross-platform-mac-windows` |
| `html body #analysis-desc-card .comp-group-label` | 4 | `codex-20260702-badge-image-fix`、`final-competitor-red-lock-20260703`、`final-competitor-heading-colors-20260703`、`final-competitor-label-and-title-lock-20260704` |
| `html body #analysis-desc-card .comp-group-label:hover` | 4 | `codex-20260702-badge-image-fix`、`final-competitor-red-lock-20260703`、`final-competitor-heading-colors-20260703`、`final-competitor-label-and-title-lock-20260704` |
| `html body #analysis-desc-card .comp-group-label:focus` | 4 | `codex-20260702-badge-image-fix`、`final-competitor-red-lock-20260703`、`final-competitor-heading-colors-20260703`、`final-competitor-label-and-title-lock-20260704` |
| `html body #api-modal .backend-note` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`v63-backend-note-white-lock`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .backend-note:hover` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`v63-backend-note-white-lock`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .backend-note:focus` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`v63-backend-note-white-lock`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .backend-note:focus-within` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`v63-backend-note-white-lock`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .backend-note *` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`v63-backend-note-white-lock`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .backend-note:hover *` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`v63-backend-note-white-lock`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .provider-tab-btn` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`final-api-gateway-no-hover-invert-20260703`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .provider-tab-btn:hover` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`final-api-gateway-no-hover-invert-20260703`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .provider-tab-btn:focus` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`final-api-gateway-no-hover-invert-20260703`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .provider-tab-btn:focus-visible` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`final-api-gateway-no-hover-invert-20260703`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .provider-tab-btn.active` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`final-api-gateway-no-hover-invert-20260703`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .provider-tab-btn.active:hover` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`final-api-gateway-no-hover-invert-20260703`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .provider-tab-btn.active:focus` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`final-api-gateway-no-hover-invert-20260703`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .provider-tab-btn.active:focus-visible` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`final-api-gateway-no-hover-invert-20260703`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .provider-tab-btn *` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`final-api-gateway-no-hover-invert-20260703`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .provider-tab-btn:hover *` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`final-api-gateway-no-hover-invert-20260703`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .provider-tab-btn.active *` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`final-api-gateway-no-hover-invert-20260703`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #api-modal .provider-tab-btn.active:hover *` | 4 | `v62-api-modal-rulemode-and-provider-tabs-fix`、`final-api-gateway-no-hover-invert-20260703`、`final-api-gateway-modal-complete-lock-20260703`、`final-api-gateway-modal-full-lock-20260704` |
| `html body #screen-3 #out-prompt` | 4 | `final-screen3-prompt-no-invert-20260703`、`v72-output-tabs-font-size-up`、`v73-experiment-red-tabs-font-adjust`、`v74-experiment-and-tabs-font-minus-005` |
| `html body #screen-3 #out-experiment` | 4 | `final-api-gateway-modal-full-lock-20260704`、`v74-experiment-and-tabs-font-minus-005`、`v112_experiment_no_hover_jump_text_110pct`、`v242-remove-experiment-click-jump` |
| `html body #screen-3 #out-experiment .experiment-grid` | 4 | `final-api-gateway-modal-full-lock-20260704`、`final-experiment-aligned-frames-20260705`、`experiment-plan-card-layout-fix-20260706`、`v169-windows-experiment-kpi-overlap-fix` |
| `html body #screen-3 #out-experiment .experiment-card` | 4 | `final-api-gateway-modal-full-lock-20260704`、`final-experiment-aligned-frames-20260705`、`v28-experiment-orange-no-hover-jump-hard-lock`、`v242-remove-experiment-click-jump` |
| `html body #screen-3 #out-experiment .experiment-card:hover` | 4 | `final-api-gateway-modal-full-lock-20260704`、`final-experiment-aligned-frames-20260705`、`v28-experiment-orange-no-hover-jump-hard-lock`、`v242-remove-experiment-click-jump` |
| `html body #screen-3 #out-experiment .experiment-card:focus-within` | 4 | `final-api-gateway-modal-full-lock-20260704`、`final-experiment-aligned-frames-20260705`、`v28-experiment-orange-no-hover-jump-hard-lock`、`v242-remove-experiment-click-jump` |
| `html body #screen-3 #out-experiment .experiment-card:hover .experiment-score` | 4 | `final-experiment-score-title-red-20260705`、`final-experiment-blue-mark-text-red-20260705`、`final-experiment-score-red-timeline-black-20260705`、`v112_experiment_no_hover_jump_text_110pct` |
| `html body #screen-3 #out-experiment .experiment-metric-row-clean:hover` | 4 | `experiment-plan-text-fit-final-20260706-2318`、`v28-experiment-orange-no-hover-jump-hard-lock`、`v169-windows-experiment-kpi-overlap-fix`、`v242-remove-experiment-click-jump` |
| `html body #screen-3 #out-experiment .experiment-metric-row-clean:focus-within` | 4 | `experiment-plan-text-fit-final-20260706-2318`、`v28-experiment-orange-no-hover-jump-hard-lock`、`v169-windows-experiment-kpi-overlap-fix`、`v242-remove-experiment-click-jump` |
| `html body #screen-3 #out-experiment .experiment-timeline .timeline-card b.timeline-day-red` | 4 | `v77-day-title-red-runtime-lock`、`v109-day-labels-always-red`、`v112_experiment_no_hover_jump_text_110pct`、`v122-day-labels-source-red-lock` |
| `html body #screen-3 #out-experiment .experiment-timeline .timeline-card:hover b.timeline-day-red` | 4 | `v77-day-title-red-runtime-lock`、`v109-day-labels-always-red`、`v112_experiment_no_hover_jump_text_110pct`、`v122-day-labels-source-red-lock` |
| `html body #screen-3 #out-experiment .experiment-timeline .timeline-card:focus-within b.timeline-day-red` | 4 | `v77-day-title-red-runtime-lock`、`v109-day-labels-always-red`、`v112_experiment_no_hover_jump_text_110pct`、`v122-day-labels-source-red-lock` |

## D. CSS 變數最終生效值總表

這份表格是「不管中間被改過幾次，實際上瀏覽器現在真正在用的值」，是未來階段6整理配色系統的依據。

| CSS變數 | 目前實際生效的值 | 生效值來自哪個補丁 |
|---|---|---|
| `--accent` | `#53d6c7` | inlined-v11-dark-theme-restore |
| `--accent-bright` | `#6872d9` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--accent-glow` | `rgba(94, 106, 210, 0.32)` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--accent-hover` | `#70e8d9` | inlined-v11-dark-theme-restore |
| `--accent-light` | `rgba(83, 214, 199, .12)` | inlined-v11-dark-theme-restore |
| `--ai-bg` | `#050816` | inlined-non-generic-product-polish |
| `--ai-bg-deep` | `#030712` | inlined-non-generic-product-polish |
| `--ai-blue` | `#3b82f6` | inlined-non-generic-product-polish |
| `--ai-border` | `rgba(125, 211, 252, .18)` | inlined-non-generic-product-polish |
| `--ai-border-strong` | `rgba(96, 165, 250, .34)` | inlined-non-generic-product-polish |
| `--ai-cyan` | `#22d3ee` | inlined-non-generic-product-polish |
| `--ai-mint` | `#5eead4` | inlined-non-generic-product-polish |
| `--ai-muted` | `#93a4ba` | inlined-non-generic-product-polish |
| `--ai-panel` | `rgba(10, 17, 34, .82)` | inlined-non-generic-product-polish |
| `--ai-panel-strong` | `rgba(15, 23, 42, .94)` | inlined-non-generic-product-polish |
| `--ai-soft` | `rgba(148, 163, 184, .12)` | inlined-non-generic-product-polish |
| `--ai-text` | `#f4f8ff` | inlined-non-generic-product-polish |
| `--ai-violet` | `#8b5cf6` | inlined-non-generic-product-polish |
| `--background-base` | `#050506` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--background-deep` | `#020203` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--background-elevated` | `#0a0a0c` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--bg` | `#06080d` | inlined-v11-dark-theme-restore |
| `--border` | `rgba(142, 162, 255, .14)` | inlined-v11-dark-theme-restore |
| `--border-accent` | `rgba(94, 106, 210, 0.38)` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--border-default` | `rgba(255, 255, 255, 0.07)` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--border-hover` | `rgba(255, 255, 255, 0.13)` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--click-blue-bg` | `#e8f3ff` | inlined-non-generic-product-polish |
| `--click-blue-bg-2` | `#dcecff` | inlined-non-generic-product-polish |
| `--click-blue-border` | `rgba(96, 165, 250, .42)` | inlined-non-generic-product-polish |
| `--click-blue-muted` | `#37516f` | inlined-non-generic-product-polish |
| `--click-blue-text` | `#0b1f3a` | inlined-non-generic-product-polish |
| `--danger` | `#DC2626` | (主樣式表) |
| `--danger-bg` | `rgba(240, 138, 138, .12)` | inlined-v11-dark-theme-restore |
| `--em-100` | `#D1FAE5` | (主樣式表) |
| `--em-200` | `#A7F3D0` | (主樣式表) |
| `--em-300` | `#6EE7B7` | (主樣式表) |
| `--em-400` | `#70e8d9` | inlined-v11-dark-theme-restore |
| `--em-50` | `rgba(83, 214, 199, .10)` | inlined-v11-dark-theme-restore |
| `--em-500` | `#53d6c7` | inlined-v11-dark-theme-restore |
| `--em-600` | `#39c6bd` | inlined-v11-dark-theme-restore |
| `--em-700` | `#94fff3` | inlined-v11-dark-theme-restore |
| `--foreground` | `#ededf0` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--foreground-muted` | `#8a8f98` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--foreground-subtle` | `rgba(255, 255, 255, 0.62)` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--glass` | `rgba(255,255,255,.3)` | (主樣式表) |
| `--glass-border` | `var(--border-default)` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--gray-100` | `var(--slate-100)` | (主樣式表) |
| `--gray-200` | `var(--slate-200)` | (主樣式表) |
| `--gray-300` | `var(--slate-300)` | (主樣式表) |
| `--gray-50` | `var(--slate-50)` | (主樣式表) |
| `--hv-badge-bg` | `#142033` | (主樣式表) |
| `--hv-badge-border` | `rgba(20,32,51,.18)` | (主樣式表) |
| `--hv-badge-shadow` | `0 8px 18px rgba(15,23,42,.16)` | (主樣式表) |
| `--hv-badge-text` | `#ffffff` | (主樣式表) |
| `--hv-dark-card-bg` | `linear-gradient(180deg,#223149,#182437)` | (主樣式表) |
| `--hv-dark-card-border` | `rgba(196,218,245,.34)` | (主樣式表) |
| `--hv-dark-card-idle-bg` | `linear-gradient(180deg,#111722,#0d121b)` | (主樣式表) |
| `--hv-dark-card-idle-border` | `rgba(226,236,255,.16)` | (主樣式表) |
| `--hv-dark-card-idle-text` | `#eaf1fa` | (主樣式表) |
| `--hv-dark-card-shadow` | `0 12px 26px rgba(18,36,58,.18)` | (主樣式表) |
| `--hv-dark-card-text` | `#f5f9ff` | (主樣式表) |
| `--hv-light-bg` | `linear-gradient(180deg,#ffffff,#f4f8fd)` | (主樣式表) |
| `--hv-light-border` | `#b9cbe0` | (主樣式表) |
| `--hv-light-shadow` | `0 14px 34px rgba(15,23,42,.16)` | (主樣式表) |
| `--hv-light-text` | `#142033` | (主樣式表) |
| `--hv-nested-bg` | `#f8fbff` | (主樣式表) |
| `--hv-nested-border` | `#c9d7e8` | (主樣式表) |
| `--impact-bg` | `#fff7f7` | inlined-non-generic-product-polish |
| `--impact-blue` | `#d71920` | inlined-non-generic-product-polish |
| `--impact-blue-2` | `#ff5a5f` | inlined-non-generic-product-polish |
| `--impact-card` | `#ffffff` | inlined-non-generic-product-polish |
| `--impact-card-soft` | `#f2f5f8` | inlined-non-generic-product-polish |
| `--impact-ink` | `#2a0505` | inlined-non-generic-product-polish |
| `--impact-muted` | `#8f4a4a` | inlined-non-generic-product-polish |
| `--industrial-accent` | `#ff4757` | inlined-non-generic-product-polish |
| `--industrial-bg` | `#e0e5ec` | inlined-non-generic-product-polish |
| `--industrial-card-shadow` | `8px 8px 16px #babecc, -8px -8px 16px #ffffff` | inlined-non-generic-product-polish |
| `--industrial-floating-shadow` | `12px 12px 24px #babecc, -12px -12px 24px #ffffff, inset 1px 1px 0 rgba(255,255,255,.55)` | inlined-non-generic-product-polish |
| `--industrial-highlight` | `#ffffff` | inlined-non-generic-product-polish |
| `--industrial-muted` | `#4a5568` | inlined-non-generic-product-polish |
| `--industrial-panel` | `#f0f2f5` | inlined-non-generic-product-polish |
| `--industrial-pressed-shadow` | `inset 6px 6px 12px #babecc, inset -6px -6px 12px #ffffff` | inlined-non-generic-product-polish |
| `--industrial-recessed` | `#d1d9e6` | inlined-non-generic-product-polish |
| `--industrial-recessed-shadow` | `inset 4px 4px 8px #babecc, inset -4px -4px 8px #ffffff` | inlined-non-generic-product-polish |
| `--industrial-shadow` | `#babecc` | inlined-non-generic-product-polish |
| `--industrial-shadow-deep` | `#a3b1c6` | inlined-non-generic-product-polish |
| `--industrial-text` | `#2d3436` | inlined-non-generic-product-polish |
| `--muted` | `var(--ai-muted)` | inlined-non-generic-product-polish |
| `--ops-accent` | `#7c84ea` | inlined-enterprise-saas-polish |
| `--ops-bg` | `#050509` | inlined-enterprise-saas-polish |
| `--ops-border` | `rgba(255, 255, 255, .11)` | inlined-enterprise-saas-polish |
| `--ops-border-strong` | `rgba(165, 180, 252, .34)` | inlined-enterprise-saas-polish |
| `--ops-green` | `#34d399` | inlined-enterprise-saas-polish |
| `--ops-muted` | `#a4a8b7` | inlined-enterprise-saas-polish |
| `--ops-panel` | `rgba(255, 255, 255, .065)` | inlined-enterprise-saas-polish |
| `--ops-panel-strong` | `rgba(255, 255, 255, .095)` | inlined-enterprise-saas-polish |
| `--ops-shadow` | `0 24px 70px rgba(0, 0, 0, .42), 0 0 80px rgba(94, 106, 210, .10)` | inlined-enterprise-saas-polish |
| `--ops-text` | `#f4f4f7` | inlined-enterprise-saas-polish |
| `--primary` | `#eef3f8` | inlined-v11-dark-theme-restore |
| `--primary-dark` | `#1d4ed8` | inlined-non-generic-product-polish |
| `--primary-soft` | `rgba(59, 130, 246, .16)` | inlined-non-generic-product-polish |
| `--product-accent` | `#8ea2ff` | inlined-v11-dark-theme-restore |
| `--product-bg` | `#06080d` | inlined-v11-dark-theme-restore |
| `--product-border` | `rgba(226, 236, 255, .10)` | inlined-v11-dark-theme-restore |
| `--product-border-2` | `rgba(142, 162, 255, .22)` | inlined-v11-dark-theme-restore |
| `--product-danger` | `#f08a8a` | inlined-non-generic-product-polish |
| `--product-good` | `#53d6c7` | inlined-v11-dark-theme-restore |
| `--product-muted` | `#8c99ad` | inlined-v11-dark-theme-restore |
| `--product-panel` | `#111722` | inlined-v11-dark-theme-restore |
| `--product-panel-2` | `#151d2a` | inlined-v11-dark-theme-restore |
| `--product-shadow` | `0 12px 34px rgba(0,0,0,.34)` | inlined-non-generic-product-polish |
| `--product-text` | `#eef3f8` | inlined-v11-dark-theme-restore |
| `--product-warn` | `#e8b86d` | inlined-non-generic-product-polish |
| `--purple` | `#7C3AED` | (主樣式表) |
| `--purple-bg` | `rgba(142, 162, 255, .14)` | inlined-v11-dark-theme-restore |
| `--radius` | `10px` | (主樣式表) |
| `--radius-lg` | `14px` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--radius-xl` | `18px` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--shadow` | `none` | inlined-v11-dark-theme-restore |
| `--shadow-glow` | `0 0 0 1px rgba(94,106,210,.42), 0 10px 30px rgba(94,106,210,.24), inset 0 1px 0 rgba(255,255,255,.15)` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--shadow-lg` | `none` | inlined-v11-dark-theme-restore |
| `--shadow-sm` | `none` | inlined-v11-dark-theme-restore |
| `--slate-100` | `#111722` | inlined-v11-dark-theme-restore |
| `--slate-200` | `rgba(226, 236, 255, .12)` | inlined-v11-dark-theme-restore |
| `--slate-300` | `rgba(226, 236, 255, .20)` | inlined-v11-dark-theme-restore |
| `--slate-400` | `#6f7b90` | inlined-v11-dark-theme-restore |
| `--slate-50` | `#0d121b` | inlined-v11-dark-theme-restore |
| `--slate-500` | `#8c99ad` | inlined-v11-dark-theme-restore |
| `--slate-600` | `#b8c2d1` | inlined-v11-dark-theme-restore |
| `--slate-700` | `#d9e2f1` | inlined-v11-dark-theme-restore |
| `--slate-800` | `#eef3f8` | inlined-v11-dark-theme-restore |
| `--slate-900` | `#03050a` | inlined-v11-dark-theme-restore |
| `--success` | `#059669` | (主樣式表) |
| `--success-bg` | `rgba(83, 214, 199, .12)` | inlined-v11-dark-theme-restore |
| `--surface` | `#111722` | inlined-v11-dark-theme-restore |
| `--surface-hover` | `rgba(255, 255, 255, 0.085)` | inlined-linear-modern-theme-for-ai-marketing2 |
| `--surface2` | `#0d121b` | inlined-v11-dark-theme-restore |
| `--teal` | `#0D9488` | (主樣式表) |
| `--teal-bg` | `rgba(83, 214, 199, .12)` | inlined-v11-dark-theme-restore |
| `--text` | `#eef3f8` | inlined-v11-dark-theme-restore |
| `--text-m` | `#7f8da3` | inlined-v11-dark-theme-restore |
| `--text-s` | `#b8c2d1` | inlined-v11-dark-theme-restore |
| `--warning` | `#D97706` | (主樣式表) |
| `--warning-bg` | `rgba(232, 184, 109, .13)` | inlined-v11-dark-theme-restore |
