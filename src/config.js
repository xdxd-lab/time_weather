/**
 * Application configuration.
 *
 * Everything that differs between environments (API hosts, timings, the
 * fallback location) lives here so the rest of the code stays declarative.
 *
 * Commercial deployments: the free Open-Meteo endpoints below are licensed for
 * non-commercial use only. Point `forecastUrl` / `geocodingUrl` at your own
 * server-side proxy that adds the subscription `apikey` — never ship an API
 * key in this static bundle, because every visitor can read it.
 */

/** @typedef {import("./types.js").Place} Place */

/** @type {Readonly<Place>} */
const DEFAULT_PLACE = Object.freeze({
  id: "default-taipei",
  name: "台北",
  region: "臺北市",
  country: "台灣",
  latitude: 25.033,
  longitude: 121.5654,
  timezone: "Asia/Taipei",
  source: "default",
});

export const APP_CONFIG = Object.freeze({
  /** BCP 47 locale used for every date, time and number format. */
  locale: "zh-TW",
  /** Language code sent to the geocoding API. */
  geocodingLanguage: "zh",
  forecastUrl: "https://api.open-meteo.com/v1/forecast",
  geocodingUrl: "https://geocoding-api.open-meteo.com/v1/search",
  /** Abort any single HTTP request after this many milliseconds. */
  requestTimeoutMs: 10_000,
  /** Give up waiting for the browser's location after this long. */
  geolocationTimeoutMs: 8_000,
  /** Reuse a cached device position for this long. */
  geolocationMaxAgeMs: 10 * 60_000,
  /** Refresh the forecast in the background at this interval. */
  refreshIntervalMs: 15 * 60_000,
  /** When the tab becomes visible again, refresh if data is older than this. */
  staleAfterMs: 10 * 60_000,
  /** Wait this long after the last keystroke before searching. */
  searchDebounceMs: 300,
  /** Maximum number of place suggestions to show. */
  searchResultLimit: 6,
  /** Number of hourly slots shown in the hourly strip. */
  hourlySlots: 24,
  /** Number of days requested for the daily forecast (1–16). */
  forecastDays: 7,
  defaultPlace: DEFAULT_PLACE,
});
