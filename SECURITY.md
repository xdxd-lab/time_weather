# 安全性政策

## 支援版本

只有 `main` 分支（也就是 <https://xdxd-lab.github.io/time_weather/> 上的版本）會收到安全性修正。

## 回報漏洞

**請不要在公開 Issue 中揭露漏洞細節。** 請透過 GitHub 的私下管道回報：

- 若本儲存庫的 **Security → Report a vulnerability** 可用，請使用該功能。
- 否則請開一個**不含技術細節**的 Issue，標題註明「安全性問題，請私下聯絡」，維護者會與你聯繫。

回報時請盡量提供：受影響的頁面或檔案、重現步驟、可能的影響，以及建議的修正方式（若有）。我們會在 7 天內回覆，並在修正後公開致謝（若你同意）。

## 現有的防護措施

- **Content Security Policy**：只允許載入同源腳本與樣式，只允許連線到 Open-Meteo API；禁止行內腳本、`eval` 與 `<base>` 改寫。
- **輸出編碼**：API 與使用者資料一律以 `textContent` 寫入畫面；`innerHTML` 只用於程式內的常數。
- **輸入驗證**：API 回應與 localStorage 中的資料都在使用前驗證，不合格的資料會被捨棄。
- **隱私**：座標四捨五入至約 1 公里後才送出；不儲存裝置位置；不使用 Cookie 或追蹤程式。
- **供應鏈**：沒有執行期相依套件；開發工具以 lockfile 鎖定版本，GitHub Actions 以 commit SHA 釘選，並由 Dependabot 每月檢查更新。
