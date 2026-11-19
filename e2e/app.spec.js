/**
 * End-to-end smoke tests: the real app in Chromium, with every Open-Meteo
 * request answered from fixtures. They cover what unit tests cannot reach —
 * the controller, rendering, the search combobox, the CSP and the layout.
 */

import { test as base, expect } from "@playwright/test";
import {
  forecastResponse,
  geocodingResponse,
} from "../tests/helpers/fixtures.js";

const FORECAST = "https://api.open-meteo.com/v1/forecast?**";
const GEOCODING = "https://geocoding-api.open-meteo.com/v1/search?**";
const TOKYO_ZONE = {
  timezone: "Asia/Tokyo",
  timezone_abbreviation: "GMT+9",
  utc_offset_seconds: 32400,
};

/**
 * @typedef {object} ApiMock
 * @property {URL[]} forecastRequests Every forecast request, in order.
 * @property {URL[]} geocodingRequests Every geocoding request, in order.
 * @property {string[]} problems Page errors, CSP violations and console
 *   errors the test did not expect.
 * @property {(pattern: RegExp) => void} allowConsoleError Accepts console
 *   errors matching `pattern` (for tests that provoke failures).
 */

const test = base.extend(
  /** @type {import("@playwright/test").Fixtures<{ api: ApiMock }>} */ ({
    api: [
      async ({ page }, use) => {
        /** @type {ApiMock} */
        const api = {
          forecastRequests: [],
          geocodingRequests: [],
          problems: [],
          allowConsoleError: (pattern) => allowed.push(pattern),
        };
        /** @type {RegExp[]} */
        const allowed = [];

        page.on("pageerror", (error) => {
          api.problems.push(`pageerror: ${error.message}`);
        });
        page.on("console", (message) => {
          const text = message.text();
          const isCsp = /Content Security Policy/i.test(text);
          if (message.type() !== "error" && !isCsp) return;
          if (!isCsp && allowed.some((pattern) => pattern.test(text))) return;
          api.problems.push(`console.${message.type()}: ${text}`);
        });

        // Keep the suite hermetic: anything that is not the dev server or a
        // mocked API host fails loudly instead of reaching the internet.
        await page.route(
          (url) =>
            url.protocol.startsWith("http") && url.hostname !== "127.0.0.1",
          (route) => {
            api.problems.push(`unexpected request: ${route.request().url()}`);
            return route.abort();
          },
        );
        await page.route(FORECAST, (route) => {
          const url = new URL(route.request().url());
          api.forecastRequests.push(url);
          // Answer like the real API: the forecast carries the place's zone.
          const inTokyo = url.searchParams.get("latitude") === "35.69";
          return route.fulfill({
            json: forecastResponse(inTokyo ? TOKYO_ZONE : {}),
          });
        });
        await page.route(GEOCODING, (route) => {
          api.geocodingRequests.push(new URL(route.request().url()));
          return route.fulfill({ json: geocodingResponse() });
        });

        await use(api);

        expect(api.problems, "unexpected errors in the page").toEqual([]);
      },
      { auto: true },
    ],
  }),
);

/** @param {import("@playwright/test").Page} page */
async function expectForecastRendered(page) {
  await expect(page.locator("#hourly-list > li.hour")).toHaveCount(24);
  await expect(page.locator("#daily-list > li.day")).toHaveCount(7);
  await expect(page.locator("#temperature")).not.toHaveText("--°");
}

/** @param {import("@playwright/test").Page} page */
async function searchTokyo(page) {
  await page.locator("#search-input").fill("Tokyo");
  // The fixture's two malformed entries are dropped.
  await expect(page.getByRole("option")).toHaveCount(2);
}

test("falls back to Taipei without location access", async ({ page, api }) => {
  await page.goto("./");

  await expect(page.locator("#place-name")).toHaveText("台北（預設）");
  await expect(page.locator("#status")).toContainText("改為顯示台北");
  await expectForecastRendered(page);
  expect(api.forecastRequests[0].searchParams.get("latitude")).toBe("25.03");
});

test("rounds the device position to ~1 km", async ({ page, context, api }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 35.689487, longitude: 139.691711 });
  await page.goto("./");

  await expect(page.locator("#place-name")).toHaveText("目前位置");
  await expectForecastRendered(page);
  const params = api.forecastRequests[0].searchParams;
  expect(params.get("latitude")).toBe("35.69");
  expect(params.get("longitude")).toBe("139.69");
});

test("selects a result by mouse and remembers it", async ({ page, api }) => {
  await page.goto("./");
  await expectForecastRendered(page);

  await searchTokyo(page);
  expect(api.geocodingRequests[0].searchParams.get("name")).toBe("Tokyo");
  await page.getByRole("option", { name: /東京/ }).click();

  await expect(page.locator("#place-name")).toHaveText("東京");
  await expect(page.locator("#search-panel")).toBeHidden();
  await expect(page.locator("#search-input")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  // Tokyo is in another time zone, so the clock shows its offset.
  await expect(page.locator("#clock-zone")).not.toBeEmpty();
  await expect
    .poll(() => api.forecastRequests.at(-1)?.searchParams.get("latitude"))
    .toBe("35.69");

  await page.reload();
  await expect(page.locator("#place-name")).toHaveText("東京");
});

test("supports keyboard selection and Escape", async ({ page }) => {
  await page.goto("./");
  await expectForecastRendered(page);
  const input = page.locator("#search-input");

  await searchTokyo(page);
  await input.press("Escape");
  await expect(page.locator("#search-panel")).toBeHidden();

  await input.press("ArrowDown");
  await expect(page.locator("#search-panel")).toBeVisible();
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    "search-option-0",
  );
  await expect(page.locator("#search-option-0")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await input.press("Enter");

  await expect(page.locator("#place-name")).toHaveText("東京");
  // Selecting clears the query and blurs the input (closes touch keyboards).
  await expect(input).toHaveValue("");
  await expect(input).not.toBeFocused();
});

test("clears the query with a second Escape", async ({ page }) => {
  await page.goto("./");
  await expectForecastRendered(page);
  const input = page.locator("#search-input");

  await searchTokyo(page);
  await input.press("Escape");
  await input.press("Escape");

  await expect(input).toHaveValue("");
  await expect(page.locator("#search-panel")).toBeHidden();
  await expect(page.locator("#place-name")).toHaveText("台北（預設）");
});

test("switches to Fahrenheit units", async ({ page, api }) => {
  await page.goto("./");
  await expectForecastRendered(page);

  await page.locator("#units-imperial").click();

  await expect(page.locator("#units-imperial")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#units-metric")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect
    .poll(() =>
      api.forecastRequests.at(-1)?.searchParams.get("temperature_unit"),
    )
    .toBe("fahrenheit");
});

test("explains a failed forecast request", async ({ page, api }) => {
  api.allowConsoleError(/status of 503|Forecast request failed/);
  await page.route(FORECAST, (route) =>
    route.fulfill({ status: 503, json: { error: true, reason: "down" } }),
  );
  await page.goto("./");

  const status = page.locator("#status");
  await expect(status).toHaveAttribute("data-tone", "error");
  await expect(status).toContainText("HTTP 503");
  await expect(page.locator("#refresh-button")).toBeEnabled();
});

for (const colorScheme of ["light", "dark"]) {
  test(`fits a 360 px screen (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("./");
    await expectForecastRendered(page);
    // The open results list once caused horizontal overflow.
    await searchTokyo(page);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
}
