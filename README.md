# 何妨吟嘯且徐行 · Time Weather

> 莫聽穿林打葉聲，何妨吟嘯且徐行。（蘇軾〈定風波〉）

[![CI](https://github.com/xdxd-lab/time_weather/actions/workflows/ci.yml/badge.svg)](https://github.com/xdxd-lab/time_weather/actions/workflows/ci.yml)

![仿宋代風俗畫的河岸市集長卷，描繪火山、雷雨、冰雹與龍捲風](docs/images/weather-scroll.webp)

**一頁看時間、現在的天氣與接下來的預報。** 用裝置位置看附近天氣，或搜尋城市，同時查看該地的當地時間。網站使用原生 HTML、CSS 與 JavaScript，開啟瀏覽器即可使用，不必安裝。

[開啟 Time Weather](https://xdxd-lab.github.io/time_weather/) · [開發指南](CONTRIBUTING.md) · [版本紀錄](CHANGELOG.md)

## 使用方式

- **看現在與未來**：目前溫度、體感、濕度、風向風速、降水、氣壓、紫外線與日出日落。左右捲動查看接下來 **24 小時**，或在 **7 日預報**比較高低溫與降雨機率。
- **切換地點**：可用中英文搜尋城市，支援注音、拼音與鍵盤操作。按「使用目前位置」會向瀏覽器要求定位；無法定位時會改用台北並顯示原因。選擇不同時區的城市時，時鐘會顯示該地時間與 UTC 偏移。
- **切換單位**：支援 °C、km/h、mm 或 °F、mph、inch。網站會在此瀏覽器記住單位與最後選擇的城市，不會儲存裝置定位座標。
- **更新與閱讀**：可手動更新。分頁可見時，網站會定期檢查資料是否需要更新；切回過期分頁或恢復連線時也會更新。同一地點更新失敗時會保留上次資料，並標示更新時間。版面支援各種裝置寬度、鍵盤操作與減少動態效果。

[查看桌面畫面範例](docs/images/screenshot-desktop.png)

## 本機開發

使用 [`.nvmrc`](.nvmrc) 指定的 Node.js 24 LTS；最低需求為 Node.js 22.13。

```bash
git clone https://github.com/xdxd-lab/time_weather.git
cd time_weather
npm ci
npm run dev
```

開啟 <http://127.0.0.1:4173/time_weather/>。本機開發伺服器沿用 GitHub Pages 的子路徑，以便提早發現資產路徑錯誤。可用 `npm run dev -- --port 8080` 改埠。

只想查看頁面也可從專案**上一層**執行 `python3 -m http.server 8000`，再開啟 <http://localhost:8000/time_weather/>。請勿直接開啟 `file://`，瀏覽器可能阻擋 ES modules；定位也需要 HTTPS 或 localhost 等安全來源。

| 指令 | 用途 |
| --- | --- |
| `npm run check` | 一次跑完 lint、格式、型別和單元測試 |
| `npm run test:coverage` | 執行單元測試並檢查覆蓋率 |
| `npm run test:e2e` | 以 Playwright 驗證真實瀏覽器操作；初次執行前先用 `npx playwright install chromium` 安裝瀏覽器 |

測試範圍、效能量測方式和重現檢查表請見[驗證與效能量測](docs/verification.md)。

## 專案結構

| 路徑 | 責任 |
| --- | --- |
| [`index.html`](index.html)、[`assets/`](assets/) | 語意化頁面、CSP、樣式及網站圖示 |
| [`src/main.js`](src/main.js)、[`src/app.js`](src/app.js) | 啟動應用程式；協調地點、預報、單位與更新狀態 |
| [`src/api/`](src/api/)、[`src/geolocation.js`](src/geolocation.js) | 外部 API、請求中止、資料驗證與瀏覽器定位 |
| [`src/ui/`](src/ui/)、[`src/i18n.js`](src/i18n.js) | 畫面、搜尋互動、圖示與介面文字 |
| [`src/config.js`](src/config.js)、[`src/format.js`](src/format.js)、[`src/storage.js`](src/storage.js) | 集中設定、時間與數值格式、本機偏好 |
| [`tests/`](tests/)、[`e2e/`](e2e/)、[`.github/workflows/ci.yml`](.github/workflows/ci.yml) | 單元與 HTML 契約測試、瀏覽器測試、持續整合 |

網站**無建置步驟、無執行期套件依賴**。Node.js、TypeScript（JSDoc／`checkJs`）、ESLint、Prettier、Playwright 都只用於開發驗證。[架構與部署](docs/architecture.md) 說明資料流、隱私邊界、設定和部署。

## 資料與限制

- 天氣與預報由 [Open-Meteo](https://open-meteo.com/) 提供，依 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 標示來源；地名來自 [GeoNames](https://www.geonames.org/)。地名搜尋的中文資料可能混用簡繁字或缺漏；找不到時可試 `Taipei`、`Kaohsiung`、`Taichung` 等英文名稱。
- 預報為數值天氣模式資料。在台灣，警特報與災害性天氣請以[中央氣象署](https://www.cwa.gov.tw/)發布為準。
- 不使用 Cookie、分析或追蹤程式。預報請求會傳送四捨五入後的座標給 Open-Meteo。資料如何流動及如何修改 API 設定，見[架構與部署](docs/architecture.md)。
- 建議使用近期 Chrome、Edge、Firefox 或 Safari（含 iOS）。CI 的端對端測試使用 Chromium；其他瀏覽器與實體裝置仍需實測。
- 公開網站使用非商業 API。商業部署前請確認 [Open-Meteo 使用條款](https://open-meteo.com/en/terms)，並在伺服器端處理 API 金鑰，勿把金鑰放在前端。

## 參與開發

請先閱讀[參與開發指南](CONTRIBUTING.md)再提交 Issue 或 Pull Request。安全性問題請依[安全性政策](SECURITY.md)私下回報。

目前規劃：空氣品質、收藏城市、英文介面、視覺回歸測試，以及離線殼層與快取策略評估。已完成的功能以[版本紀錄](CHANGELOG.md)為準。

## 授權

本專案尚未指定開放原始碼授權，程式碼權利保留。資料提供者的授權與標示要求獨立於本專案程式碼。
