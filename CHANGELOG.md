# 變更紀錄

本專案的重要變更記錄於此。格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本號遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

## [Unreleased]

### 新增

- Playwright 端對端測試（Chromium，於 CI 執行）：定位備援與座標四捨五入、城市搜尋的滑鼠與鍵盤操作、記住城市、°F 切換、API 錯誤訊息、360px 寬度版面（淺色／深色），並在出現頁面錯誤或 CSP 違規時判定失敗。

## [1.0.0] - 2026-11-19

全面改版：從單一 HTML 檔案重構為模組化、可測試、可長期專業維護的專案。

### 新增

- 未來 24 小時逐時預報（溫度、天氣圖示、降雨機率）。
- 7 日預報，含降雨機率與高低溫區間條。
- 城市搜尋（Open-Meteo Geocoding API），支援鍵盤操作與注音／拼音輸入法。
- 「使用目前位置」按鈕；定位失敗時說明原因並改用台北。
- °C／°F 單位切換，並記住單位與最後搜尋的城市。
- 選擇其他時區的城市時，時鐘改為顯示當地時間與 UTC 偏移。
- 更多目前天氣資訊：今日高低溫、相對濕度、風向、降水量、紫外線指數、氣壓、日出日落。
- 依天氣與日夜變換的背景、深色模式、減少動態效果與高對比模式支援。
- 自動更新：分頁開著時資料超過 15 分鐘、切回分頁且資料過舊、恢復網路時。
- 網頁標題顯示目前溫度與天氣；Web App Manifest、App 圖示與社群分享資訊。
- 開發工具：ESLint、Prettier、TypeScript 型別檢查、零相依開發伺服器。
- 單元測試與 HTML 契約測試；GitHub Actions CI；Dependabot；PR 與 Issue 範本。
- 專業文件：README、CONTRIBUTING、CHANGELOG、SECURITY。

### 變更

- 程式拆分為 API、格式化、狀態控制、畫面渲染等模組，樣式移至獨立 CSS。
- 所有請求加入逾時與取消；切換城市時不會被過期回應覆蓋。
- 錯誤訊息改為可行動的中文說明，更新失敗時保留上一次的資料並標示時間。
- Open-Meteo 資料來源改為頁尾固定連結（符合 CC BY 4.0），並加上 GeoNames 標示。

### 安全性與隱私

- 新增嚴格的 Content Security Policy，移除所有行內腳本與樣式。
- 送出的座標四捨五入至約 1 公里；不儲存裝置位置。

[Unreleased]: https://github.com/xdxd-lab/time_weather/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/xdxd-lab/time_weather/releases/tag/v1.0.0
