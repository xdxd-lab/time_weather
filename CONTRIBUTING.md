# 參與開發指南

感謝你願意改進 Time Weather！這份文件說明開發環境、程式風格與發布流程。

## 開發環境

1. 安裝 Node.js 22.13 以上（建議 [`.nvmrc`](.nvmrc) 的 24 LTS，使用 nvm 可執行 `nvm use`）。
2. 安裝開發工具：`npm ci`
3. 啟動：`npm run dev`，開啟 <http://127.0.0.1:4173/time_weather/>

應用程式本身**沒有建置步驟，也沒有執行期相依套件**；`node_modules` 只放 lint、排版、型別檢查等工具，不會部署。

## 開發流程

1. 從 `main` 建立分支，名稱建議 `feat/…`、`fix/…`、`docs/…`、`chore/…`。
2. 修改程式並補上測試。
3. 送出前執行 `npm run check`（lint、格式、型別、單元測試）。
4. 以 `npm run dev` 在瀏覽器實際操作，至少檢查：桌面與手機寬度（360–390px）、深色模式、鍵盤操作。
5. 開 Pull Request 並填寫範本。CI 通過且經過審查後再合併。

## 程式風格

- **排版交給工具**：JavaScript、CSS、JSON、YAML 由 Prettier 處理（`npm run format`）；HTML 與 Markdown 手動維持整齊。
- **型別**：所有函式以 JSDoc 標註參數與回傳型別，共用型別放在 `src/types.js`。`npm run typecheck` 以 strict 模式檢查。
- **分層**：
  - `src/api/`、`format.js`、`weather-codes.js`、`storage.js` 等**不碰 DOM**，必須有單元測試。
  - `src/ui/` 只負責渲染與互動，不直接呼叫 API。
  - `src/app.js` 是唯一持有應用程式狀態（地點、預報、偏好）並協調流程的地方；UI 元件只保存自身的互動狀態。
- **介面文字**：一律寫在 `src/i18n.js`，以 `t("key")` 取用，不要寫死在程式中。
- **安全（CSP）**：
  - 不要在 HTML 中加入行內 `<script>`、`<style>` 或 `style="…"` 屬性。
  - 動態樣式用 CSS class，或 `element.style.setProperty()`。
  - API 或使用者資料一律用 `textContent` 寫入；`innerHTML` 只能用於程式內的常數（例如 SVG 圖示）。
  - 新增對外連線時，同步更新 `index.html` CSP 的 `connect-src`。
- **相容性**：只使用 [README](README.md#瀏覽器支援) 列出的瀏覽器都支援的語法與 API。
- **錯誤處理**：網路錯誤要轉成 `RequestError`，由 `errors.js` 轉成使用者看得懂的訊息；被取消的請求（`aborted`）不顯示錯誤。

## 測試

- 測試使用 Node 內建的 `node:test` 與 `node:assert/strict`，檔名為 `tests/**/*.test.js`。
- 測試資料請用 `tests/helpers/fixtures.js` 的建構函式，形狀要符合真實 API 回應。
- `tests/markup.test.js` 檢查 HTML 與程式碼之間的契約（元素 id、CSP、資料來源標示、相對路徑）。改 HTML 結構時請一起更新。
- 覆蓋率門檻：行 95%、分支 85%、函式 90%（`npm run test:coverage`，CI 會強制檢查）。

## Commit 訊息

使用英文祈使句標題（不超過 72 字元），必要時空一行後說明「為什麼」：

```text
Cancel stale forecast requests when the place changes

Responses could arrive out of order and overwrite the newer place.
```

## 發布流程

1. 在 [CHANGELOG.md](CHANGELOG.md) 的 `Unreleased` 區塊整理變更，改為新版本號與日期。
2. 同步更新 `package.json` 的 `version`（遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)）。
3. 合併到 `main`。GitHub Pages 約 1 分鐘內自動部署。
4. 開啟 <https://xdxd-lab.github.io/time_weather/> 確認線上版本（必要時強制重新整理）。
5. 建立 Git tag 與 GitHub Release（例如 `v1.1.0`），CHANGELOG 的版本連結會指向它。
