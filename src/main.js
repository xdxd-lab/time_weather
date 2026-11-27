/**
 * Browser entry point. App owns the state and binds the page's controls;
 * keep this module limited to bootstrapping and startup failure reporting.
 */

import { App } from "./app.js";

try {
  new App().start();
} catch (error) {
  // Leave a readable status if a markup mismatch or another startup error
  // prevents the app from initializing.
  console.error("[time-weather] Failed to start:", error);
  const status = document.getElementById("status");
  if (status) {
    status.textContent = "頁面載入失敗，請重新整理後再試";
    status.dataset.tone = "error";
  }
}
