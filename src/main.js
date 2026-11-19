/**
 * Entry point, loaded as an ES module by index.html.
 */

import { App } from "./app.js";

try {
  new App().start();
} catch (error) {
  // Startup only fails if index.html and the scripts are out of sync.
  console.error("[time-weather] Failed to start:", error);
  const status = document.getElementById("status");
  if (status) {
    status.textContent = "頁面載入失敗，請重新整理後再試";
    status.dataset.tone = "error";
  }
}
