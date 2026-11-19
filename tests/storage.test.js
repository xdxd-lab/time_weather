import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  STORAGE_KEY,
  defaultPreferences,
  loadPreferences,
  sanitizePreferences,
  savePreferences,
} from "../src/storage.js";

function memoryStore() {
  /** @type {Map<string, string>} */
  const data = new Map();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

const brokenStore = {
  getItem() {
    throw new Error("SecurityError: storage is disabled");
  },
  setItem() {
    throw new Error("QuotaExceededError");
  },
};

const tokyo = {
  id: "geo-1850147",
  name: "東京",
  region: "東京都",
  country: "日本",
  latitude: 35.6895,
  longitude: 139.69171,
  timezone: "Asia/Tokyo",
  source: "search",
};

describe("preferences storage", () => {
  it("starts with metric units and no saved place", () => {
    assert.deepEqual(defaultPreferences(), { units: "metric", place: null });
    assert.deepEqual(loadPreferences(memoryStore()), defaultPreferences());
    assert.deepEqual(loadPreferences(null), defaultPreferences());
  });

  it("round-trips units and a searched place", () => {
    const store = memoryStore();
    const preferences = { units: "imperial", place: tokyo };
    assert.equal(savePreferences(store, preferences), true);
    assert.deepEqual(loadPreferences(store), preferences);
  });

  it("never stores the device's position", () => {
    const store = memoryStore();
    const device = { ...tokyo, id: "device", source: "device" };
    savePreferences(store, { units: "metric", place: device });
    assert.deepEqual(JSON.parse(store.data.get(STORAGE_KEY) ?? "{}"), {
      units: "metric",
      place: null,
    });
  });

  it("ignores corrupt or tampered data", () => {
    const store = memoryStore();
    store.setItem(STORAGE_KEY, "{not json");
    assert.deepEqual(loadPreferences(store), defaultPreferences());

    store.setItem(
      STORAGE_KEY,
      JSON.stringify({ units: "kelvin", place: { ...tokyo, latitude: 200 } }),
    );
    assert.deepEqual(loadPreferences(store), defaultPreferences());
  });

  it("survives storage that throws", () => {
    assert.deepEqual(loadPreferences(brokenStore), defaultPreferences());
    assert.equal(savePreferences(brokenStore, defaultPreferences()), false);
  });

  it("drops unknown fields from saved places", () => {
    const preferences = sanitizePreferences({
      units: "metric",
      place: { ...tokyo, script: "<img onerror=alert(1)>" },
    });
    assert.deepEqual(preferences.place, tokyo);
  });
});
