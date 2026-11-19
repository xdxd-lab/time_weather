import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSearchUrl,
  cleanLabel,
  describePlaceRegion,
  normalizeQuery,
  parseSearchResults,
  searchPlaces,
} from "../src/api/geocoding.js";
import { RequestError } from "../src/api/http.js";
import { fakeFetch, geocodingResponse } from "./helpers/fixtures.js";

describe("normalizeQuery", () => {
  it("trims and collapses whitespace", () => {
    assert.equal(normalizeQuery("  New   York \n"), "New York");
  });
});

describe("buildSearchUrl", () => {
  it("builds a JSON search request", () => {
    const url = buildSearchUrl({ query: " Tokyo ", count: 4 });
    assert.equal(url.host, "geocoding-api.open-meteo.com");
    assert.equal(url.searchParams.get("name"), "Tokyo");
    assert.equal(url.searchParams.get("count"), "4");
    assert.equal(url.searchParams.get("language"), "zh");
    assert.equal(url.searchParams.get("format"), "json");
  });
});

describe("parseSearchResults", () => {
  it("maps results to places and skips malformed entries", () => {
    const places = parseSearchResults(geocodingResponse());
    assert.equal(places.length, 2);
    assert.deepEqual(places[0], {
      id: "geo-1850147",
      name: "東京",
      region: "東京都",
      country: "日本",
      latitude: 35.6895,
      longitude: 139.69171,
      timezone: "Asia/Tokyo",
      source: "search",
    });
    assert.equal(places[1].region, "臺灣省");
  });

  it("returns an empty list when nothing matches", () => {
    assert.deepEqual(parseSearchResults({ generationtime_ms: 0.3 }), []);
  });

  it("rejects a response that is not an object", () => {
    assert.throws(
      () => parseSearchResults("oops"),
      (error) => error instanceof RequestError && error.kind === "parse",
    );
  });
});

describe("cleanLabel", () => {
  it("keeps the first of several alternatives", () => {
    assert.equal(cleanLabel("臺灣省 or 台灣省"), "臺灣省");
    assert.equal(cleanLabel("日本"), "日本");
    assert.equal(cleanLabel(""), undefined);
    assert.equal(cleanLabel(null), undefined);
  });
});

describe("searchPlaces", () => {
  it("does not send queries shorter than two characters", async () => {
    const { fetchImpl, calls } = fakeFetch(geocodingResponse());
    assert.deepEqual(await searchPlaces(" a ", { fetchImpl }), []);
    assert.equal(calls.length, 0);
  });

  it("searches and parses results", async () => {
    const { fetchImpl, calls } = fakeFetch(geocodingResponse());
    const places = await searchPlaces("Tokyo", { fetchImpl, count: 3 });
    assert.equal(places[0].name, "東京");
    assert.match(calls[0], /name=Tokyo&count=3/);
  });
});

describe("describePlaceRegion", () => {
  it("joins region and country without duplicates", () => {
    assert.equal(
      describePlaceRegion({ region: "東京都", country: "日本" }),
      "東京都・日本",
    );
    assert.equal(
      describePlaceRegion({ region: "Singapore", country: "Singapore" }),
      "Singapore",
    );
    assert.equal(describePlaceRegion({}), "");
  });
});
