import { expect, test } from "@playwright/test";
import { forecastResponse } from "../tests/helpers/fixtures.js";

test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.protocol.startsWith("http") && url.hostname !== "127.0.0.1",
    (route) => route.abort(),
  );
  await page.route("https://api.open-meteo.com/v1/forecast?**", (route) =>
    route.fulfill({ json: forecastResponse() }),
  );
});

test("expands forecast details with the keyboard and linkless disclosure", async ({
  page,
}) => {
  await page.goto("./");
  const first = page.locator("#daily-list .day-toggle").first();
  const summary = first.locator("summary");
  await expect(summary).toContainText("今天");
  await expect(first.locator(".day-details")).toBeHidden();

  await summary.focus();
  await summary.press("Enter");
  await expect(first).toHaveAttribute("open", "");
  await expect(first.getByText("日出", { exact: true })).toBeVisible();
  await expect(first.getByText("最高紫外線", { exact: true })).toBeVisible();
  await expect(summary).toBeFocused();

  await summary.press("Space");
  await expect(first.locator(".day-details")).toBeHidden();
});

test("draws an hourly temperature trend and hides it without enough readings", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("#hourly-trend")).toBeVisible();
  await expect(page.locator("#hourly-trend-range")).toContainText(
    "最高 24°・最低 15°",
  );
  await expect(page.locator("#hourly-trend-line")).toHaveAttribute("d", /^M/);

  const incomplete = forecastResponse();
  incomplete.hourly.temperature_2m = incomplete.hourly.time.map(() => null);
  await page.route("https://api.open-meteo.com/v1/forecast?**", (route) =>
    route.fulfill({ json: incomplete }),
  );
  await page.locator("#refresh-button").click();
  await expect(page.locator("#hourly-trend")).toBeHidden();
});

for (const [width, scheme] of [
  [320, "light"],
  [390, "dark"],
  [1440, "light"],
]) {
  test(`weather dashboard fits ${width}px (${scheme}) with details open`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: Number(width), height: 960 });
    await page.emulateMedia({
      colorScheme: scheme === "dark" ? "dark" : "light",
      reducedMotion: "reduce",
    });
    await page.goto("./");
    await expect(page.locator("#hourly-list > li.hour")).toHaveCount(24);
    await page.locator("#daily-list summary").first().click();
    const layout = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      hourlyScroll:
        /** @type {HTMLElement} */ (document.querySelector("#hourly-list"))
          .scrollWidth >
        /** @type {HTMLElement} */ (document.querySelector("#hourly-list"))
          .clientWidth,
    }));
    expect(layout.page).toBe(layout.viewport);
    expect(layout.hourlyScroll).toBe(true);
    await expect(page.locator("#detail-sunset")).not.toHaveText("--");
  });
}
