# 參與開發指南

Time Weather 是原生 ES modules 靜態網站。應用程式沒有建置步驟，也不會部署 `node_modules`。安裝開發工具與啟動方式見 [README](README.md#本機開發)。

## 從問題到 Pull Request

1. **釐清範圍。** 修正請記錄目前行為、預期行為、重現步驟與瀏覽器。較大的功能、資料來源或相容性變更，先在 Issue 對齊範圍和驗收條件。
2. **用最新的 `main` 建立分支。** 例如 `feat/forecast-search`、`fix/location-timeout`、`docs/verification-guide` 或 `chore/toolchain`。一個 PR 解決一件事，避免把無關的排版改動混進來。
3. **補上對應驗證。** 純函式與 API 契約使用 Node 測試；瀏覽器互動及競態增加 Playwright 案例。更新使用方式時同步改 [README](README.md)，使用者可見的重要變更記在 [CHANGELOG.md](CHANGELOG.md) 的 `Unreleased`。
4. **填寫 PR 範本。** 附上驗證指令和結果、未測項目、相容性或資料風險；UI 變更附桌面與手機前後對照，效能變更附相同條件下的前後樣本。
5. **通過 CI 並完成審查後才合併。** 以測試結果和實際操作為主，不以「預期會通過」代替驗收。主分支會影響公開站，維護者合併前先確認改動範圍。

## PR 自查清單

- [ ] `npm run check` 和相關瀏覽器測試均通過；若某項只能在 CI 執行，在 PR 說明。
- [ ] UI 在 360–390 px、桌面、淺／深色、鍵盤與減少動態效果下仍可操作。
- [ ] 涉及請求、定位或儲存時，涵蓋成功、失敗與重疊操作；不記錄裝置座標，不新增未說明的對外請求。
- [ ] 新設定有合理預設值，必要時同步調整文件、HTML 契約測試與 CSP。
- [ ] 無測試產物、憑證、個人位置或無關改動；已說明需要維護者確認的事項。

## 程式慣例

- **責任分層。** `src/app.js` 協調狀態；`src/ui/` 接收資料、渲染與處理互動；API 與格式化邏輯不碰 DOM。搜尋元件使用控制器注入的查詢函式，不自行對外連線。共用型別放在 `src/types.js`，以 JSDoc 和 TypeScript strict `checkJs` 驗證。
- **錯誤與競態。** 對外回應先驗證。使用 `RequestError`／`describeError` 將失敗映射成可行動訊息；取消不是使用者錯誤。地點、單位或定位請求重疊時，只有最新選擇可更新畫面。
- **資產與安全。** HTML 使用相對路徑，不加入行內腳本或樣式。API 或使用者輸入用 `textContent` 或安全 DOM API；`innerHTML` 限可信的程式內常數。變更外部主機時一起檢查 CSP、隱私說明與測試。
- **介面與排版。** 介面文字集中在 `src/i18n.js`。JavaScript、CSS、JSON、YAML 使用 Prettier（`npm run format`）；HTML 和 Markdown 手動維持一致。
- **提交文字。** 標題用簡短動詞片語，一筆提交完成一項變更。例如 `Cancel stale forecast requests on place change`。有競態或取捨時，在內文說明原因。

## 驗證與發布

跑測試、查看失敗追蹤、量測效能與記錄相容性，請依[驗證與效能量測](docs/verification.md)。

發布時，維護者：

1. 整理 `Unreleased`，確認版本號、日期及比較連結；僅在發布 PR 同步更改 `package.json` 和 `package-lock.json` 的版本。
2. 看過 CI 及 PR 的最新提交後合併到 `main`。
3. 等 GitHub Pages 部署成功，再以正式入口驗證會影響使用者的操作。若發現回歸，優先用一筆可追溯的 revert 修正，避免強制推送。
4. 對已驗證的發布提交建立版本標籤和 GitHub Release（例如 `v1.1.0`），並保留可追蹤的變更紀錄。
