/**
 * Contract tests between index.html and the scripts. They catch a renamed id,
 * an inline script or a missing CSP host without starting a browser.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { DEFAULT_FORECAST_URL } from "../src/api/forecast.js";
import { DEFAULT_GEOCODING_URL } from "../src/api/geocoding.js";
import { APP_CONFIG } from "../src/config.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const html = await read("../index.html");

describe("index.html", () => {
  it("contains every element the scripts look up by id", async () => {
    const sources = await Promise.all(
      ["../src/app.js", "../src/ui/view.js"].map(read),
    );
    const ids = sources.flatMap((source) =>
      [...source.matchAll(/requireElement\(\s*"([^"]+)"/g)].map((m) => m[1]),
    );
    assert.ok(ids.length > 20, "found the lookups");
    for (const id of ids) {
      assert.match(html, new RegExp(`id="${id}"`), `#${id} exists`);
    }
  });

  it("allows exactly the API hosts the app calls", () => {
    const csp = /Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1];
    assert.ok(csp, "has a CSP meta tag");
    for (const url of [
      DEFAULT_FORECAST_URL,
      DEFAULT_GEOCODING_URL,
      APP_CONFIG.forecastUrl,
      APP_CONFIG.geocodingUrl,
    ]) {
      assert.ok(csp.includes(new URL(url).origin), `connect-src ${url}`);
    }
    assert.match(csp, /script-src 'self';/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  });

  it("has no inline scripts, inline styles or style attributes", () => {
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/);
    assert.doesNotMatch(html, /<style[\s>]/);
    assert.doesNotMatch(html, /\sstyle="/);
  });

  it("credits Open-Meteo (CC BY 4.0) and GeoNames next to the data", () => {
    assert.match(html, /href="https:\/\/open-meteo\.com\/"/);
    assert.match(html, /creativecommons\.org\/licenses\/by\/4\.0/);
    assert.match(html, /href="https:\/\/www\.geonames\.org\/"/);
  });

  it("uses only relative asset paths, so it works under /time_weather/", () => {
    for (const [, path] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      assert.ok(
        /^(https?:|#)/.test(path) || !path.startsWith("/"),
        `${path} is relative`,
      );
    }
  });
});
