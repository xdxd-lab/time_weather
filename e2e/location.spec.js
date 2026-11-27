/** Real entry point in a mobile browser context; never contacts real APIs. */
import { test, expect } from "@playwright/test";
import {
  forecastResponse,
  geocodingResponse,
} from "../tests/helpers/fixtures.js";

test.use({
  isMobile: true,
  hasTouch: true,
  viewport: { width: 390, height: 844 },
});

const geocoding = "https://geocoding-api.open-meteo.com/v1/search?**";
const forecast = "https://api.open-meteo.com/v1/forecast?**";
const kaohsiung = { latitude: 22.627279, longitude: 120.301437 };
const secondFix = { latitude: 24.147736, longitude: 120.673648 };
const key = "time-weather:preferences:v1";

async function recordForecasts(page) {
  const requests = [];
  await page.route(geocoding, (route) =>
    route.fulfill({ json: geocodingResponse() }),
  );
  await page.route(forecast, (route) => {
    requests.push(new URL(route.request().url()).searchParams);
    return route.fulfill({ json: forecastResponse() });
  });
  return requests;
}

test("Taipei fallback recovers after site permission is granted", async ({
  page,
  context,
}) => {
  const requests = await recordForecasts(page);
  await context.setGeolocation(kaohsiung);
  await page.goto("./");
  await expect(page.locator("#place-name")).toHaveText("台北（預設）");
  await expect(page.locator("#status")).toContainText("改為顯示台北");
  expect(requests[0].get("latitude")).toBe("25.03");

  await context.grantPermissions(["geolocation"]);
  await expect(page.locator("#place-name")).toHaveText("目前位置");
  await expect.poll(() => requests.at(-1)?.get("latitude")).toBe("22.63");
  expect(requests.at(-1).get("longitude")).toBe("120.30");
  await expect(page.locator("#status")).not.toContainText("改為顯示台北");
  const saved = await page.evaluate((k) => localStorage.getItem(k), key);
  expect(JSON.parse(saved).place).toBeNull();
  expect(saved).not.toMatch(/22.62|120.30/);
});

test("keeps intentional Taipei until Locate switches to device mode, which survives reload", async ({
  page,
  context,
}) => {
  const requests = await recordForecasts(page);
  await context.setGeolocation(kaohsiung);
  await context.grantPermissions(["geolocation"]);
  await page.addInitScript((k) => {
    if (sessionStorage.getItem("geo-test-seeded")) return;
    sessionStorage.setItem("geo-test-seeded", "yes");
    localStorage.setItem(
      k,
      JSON.stringify({
        units: "metric",
        place: {
          source: "search",
          id: "taipei",
          name: "臺北",
          latitude: 25.03,
          longitude: 121.57,
        },
      }),
    );
  }, key);
  await page.goto("./");
  await expect(page.locator("#place-name")).toHaveText("臺北");
  await expect.poll(() => requests.at(-1)?.get("latitude")).toBe("25.03");

  await page.locator("#locate-button").click();
  await expect(page.locator("#place-name")).toHaveText("目前位置");
  await expect.poll(() => requests.at(-1)?.get("latitude")).toBe("22.63");
  await page.reload();
  await expect(page.locator("#place-name")).toHaveText("目前位置");
  await expect(page.locator("#hourly-list > li.hour")).toHaveCount(24);

  await context.setGeolocation(secondFix);
  await page.locator("#refresh-button").click();
  await expect.poll(() => requests.at(-1)?.get("latitude")).toBe("24.15");
  expect(requests.at(-1).get("longitude")).toBe("120.67");
});

test("a slow GPS callback cannot overwrite a city chosen while it was pending", async ({
  page,
}) => {
  const requests = await recordForecasts(page);
  await page.addInitScript((position) => {
    navigator.geolocation.getCurrentPosition = (success) => {
      window.reportLatePosition = () => success({ coords: position });
    };
  }, kaohsiung);
  await page.goto("./");
  await page.waitForFunction(
    () => typeof window.reportLatePosition === "function",
  );

  await page.locator("#search-input").fill("Tokyo");
  await page.getByRole("option", { name: /東京/ }).click();
  await expect(page.locator("#place-name")).toHaveText("東京");
  await expect.poll(() => requests.at(-1)?.get("latitude")).toBe("35.69");

  await page.evaluate(() => window.reportLatePosition());
  await expect(page.locator("#hourly-list > li.hour")).toHaveCount(24);
  await expect(page.locator("#place-name")).toHaveText("東京");
  expect(requests.map((p) => p.get("latitude"))).toEqual(["35.69"]);
});
