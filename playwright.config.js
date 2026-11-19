import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const isCI = Boolean(process.env.CI);

/**
 * End-to-end tests run the real app in Chromium against the local dev server.
 * Every Open-Meteo request is answered from fixtures, so the suite is
 * deterministic and never touches the network.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Longer than the app's 8 s geolocation guard, so a slow permission
  // denial still reaches the fallback before an assertion gives up.
  expect: { timeout: 10_000 },
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}/time_weather/`,
    locale: "zh-TW",
    timezoneId: "Asia/Taipei",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node scripts/serve.mjs --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/time_weather/`,
    reuseExistingServer: !isCI,
    timeout: 30_000,
  },
});
