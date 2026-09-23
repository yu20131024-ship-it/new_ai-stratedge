# 公鑑 FairView — AI API / API Key 技術檢核（2026-09-22）

## 本次緊急修正

1. Agnes 預設模型由 `agnes-2.0-flash` 更新為可編輯的 `agnes-2.5-flash`。
2. `agnes-3.0-flash` 保留為可直接輸入的模型 ID；未來原廠換模型時不需要改程式碼即可輸入新 ID。
3. API Key 不再硬編任何第三方公開金鑰。
4. 新增 NVIDIA NIM、GroqCloud、OpenRouter、Mistral AI Studio 四個 BYOK 供應商模組。
5. 所有新增 OpenAI-compatible 供應商均採「Base URL + API Key + Model ID」架構，Model ID 存在 sessionStorage，可由使用者更新。
6. Claude、Gemini 的 Model ID 也改為可編輯，不再把模型 ID 固定在呼叫函式內。
7. Claude Web Search 工具版本更新為 `web_search_20260318`，並指定 `allowed_callers: ['direct']`，避免新版工具預設走動態篩選時產生額外執行依賴。

## 官方文件對照

| 供應商 | 官方 API 形式 | 本專案端點／模式 | 模型是否可修改 | 檢核結果 |
|---|---|---|---|---|
| Claude | Anthropic Messages API `POST /v1/messages` | `https://api.anthropic.com/v1/messages` | 是 | 已更新；Web Search 改用目前文件中的 `web_search_20260318` |
| Gemini | Gemini native `generateContent` | `https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent` | 是 | 保留原生路徑以維持 Google Search grounding |
| Agnes AI | OpenAI-compatible Chat Completions | `https://apihub.agnes-ai.com/v1/chat/completions` | 是 | 預設 `agnes-2.5-flash`；`agnes-3.0-flash` 可輸入 |
| NVIDIA NIM | OpenAI-compatible Chat Completions | `https://integrate.api.nvidia.com/v1/chat/completions` | 是 | 新增 |
| GroqCloud | OpenAI-compatible Chat Completions | `https://api.groq.com/openai/v1/chat/completions` | 是 | 新增 |
| OpenRouter | OpenAI-compatible Chat Completions | `https://openrouter.ai/api/v1/chat/completions` | 是 | 新增 |
| Mistral AI Studio | OpenAI-compatible Chat Completions | `https://api.mistral.ai/v1/chat/completions` | 是 | 新增 |

## 官方文件

- Anthropic Messages API / API overview: https://platform.claude.com/docs/en/api/messages/create
- Anthropic Web Search Tool: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- Google Gemini OpenAI compatibility: https://ai.google.dev/gemini-api/docs/openai
- Google Gemini models: https://ai.google.dev/gemini-api/docs/models
- NVIDIA NIM LLM API: https://docs.api.nvidia.com/nim/re/reference/llm-apis
- NVIDIA NIM API reference: https://docs.nvidia.com/nim/large-language-models/latest/thinking-budget-control.html
- Groq OpenAI compatibility: https://console.groq.com/docs/openai
- Groq model list: https://console.groq.com/docs/models
- OpenRouter Quickstart: https://openrouter.ai/docs/quickstart
- Mistral migration / OpenAI compatibility: https://docs.mistral.ai/resources/migration-guides
- Mistral Chat API: https://docs.mistral.ai/api

## 免費模型 / 免費 API Key 原則

本專案**不把「免費模型」當成永久固定清單**。供應商的免費額度、模型名稱、preview/retired 狀態與限制可能變動，因此 UI 提供可編輯 Model ID。

這裡不把任何 API Key 寫進程式碼，也不宣稱某一組第三方金鑰永久免費。使用者應自行從各原廠取得自己的 Key，並遵守原廠當期的免費額度與使用政策。

## 已知限制

- 純前端 BYOK 仍代表 API Key 存在瀏覽器記憶體中；正式商用若需要更高安全性，應改成 server-side proxy / environment variables。
- 新增 OpenAI-compatible 供應商是否允許瀏覽器直接跨域，取決於各原廠 CORS 設定；「測試連線」會先驗證 Key、端點與模型。
- 新增四家供應商目前以通用 Chat Completions 為主，不宣稱具備 Claude/Gemini 專用搜尋 grounding 能力。
- OpenRouter 的 model slug/alias 可由使用者自行輸入；原廠新增模型不需要修改前端呼叫函式。
