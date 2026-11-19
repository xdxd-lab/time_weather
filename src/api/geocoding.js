/**
 * Open-Meteo Geocoding API client (place search by name or postal code).
 * Location data is based on GeoNames and must be credited in the UI.
 * @see https://open-meteo.com/en/docs/geocoding-api
 */

import { fetchJson } from "./http.js";
import { roundCoordinate } from "./forecast.js";
import {
  isRecord,
  optionalNumber,
  optionalString,
  requireArray,
  requireRecord,
} from "./validate.js";

/** @typedef {import("../types.js").Place} Place */

export const DEFAULT_GEOCODING_URL =
  "https://geocoding-api.open-meteo.com/v1/search";

/** The API returns nothing for shorter queries, so don't send them. */
export const MIN_QUERY_LENGTH = 2;

/**
 * Trims and collapses whitespace so "  New   York " and "New York" are the
 * same search.
 * @param {string} query
 */
export function normalizeQuery(query) {
  return query.trim().replace(/\s+/g, " ");
}

/**
 * @typedef {object} SearchQuery
 * @property {string} query
 * @property {string} [language] Lower-case language code, defaults to "zh".
 * @property {number} [count] Maximum results (1–100), defaults to 6.
 * @property {string} [baseUrl]
 */

/**
 * @param {SearchQuery} search
 * @returns {URL}
 */
export function buildSearchUrl(search) {
  const url = new URL(search.baseUrl ?? DEFAULT_GEOCODING_URL);
  url.searchParams.set("name", normalizeQuery(search.query));
  url.searchParams.set("count", String(search.count ?? 6));
  url.searchParams.set("language", search.language ?? "zh");
  url.searchParams.set("format", "json");
  return url;
}

/**
 * Converts a Geocoding API response into places. Individual malformed entries
 * are skipped rather than failing the whole search.
 * @param {unknown} data
 * @returns {Place[]}
 */
export function parseSearchResults(data) {
  const root = requireRecord(data, "geocoding");
  // The API omits `results` entirely when nothing matches.
  if (root.results === undefined) return [];
  const results = requireArray(root.results, "geocoding.results");

  /** @type {Place[]} */
  const places = [];
  for (const entry of results) {
    if (!isRecord(entry)) continue;
    const name = optionalString(entry.name);
    const latitude = optionalNumber(entry.latitude);
    const longitude = optionalNumber(entry.longitude);
    if (name === null || latitude === null || longitude === null) continue;
    const id = optionalNumber(entry.id);
    places.push({
      id:
        id === null
          ? `geo-${roundCoordinate(latitude)},${roundCoordinate(longitude)}`
          : `geo-${id}`,
      name,
      region: cleanLabel(entry.admin1),
      country: cleanLabel(entry.country),
      latitude,
      longitude,
      timezone: optionalString(entry.timezone) ?? undefined,
      source: "search",
    });
  }
  return places;
}

/**
 * GeoNames sometimes stores alternatives as "臺灣省 or 台灣省"; keep the first.
 * @param {unknown} value
 * @returns {string | undefined}
 */
export function cleanLabel(value) {
  const text = optionalString(value);
  if (text === null) return undefined;
  return text.split(" or ")[0].trim() || undefined;
}

/**
 * @typedef {object} SearchPlacesOptions
 * @property {string} [language]
 * @property {number} [count]
 * @property {string} [baseUrl]
 * @property {AbortSignal} [signal]
 * @property {number} [timeoutMs]
 * @property {typeof fetch} [fetchImpl]
 */

/**
 * Searches for places by name. Queries shorter than MIN_QUERY_LENGTH resolve
 * to an empty list without a network request.
 * @param {string} query
 * @param {SearchPlacesOptions} [options]
 * @returns {Promise<Place[]>}
 */
export async function searchPlaces(query, options = {}) {
  if (normalizeQuery(query).length < MIN_QUERY_LENGTH) return [];
  const url = buildSearchUrl({
    query,
    language: options.language,
    count: options.count,
    baseUrl: options.baseUrl,
  });
  const data = await fetchJson(url, {
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
  });
  return parseSearchResults(data);
}

/**
 * One-line description for a place, e.g. "臺北市・台灣".
 * @param {Pick<Place, "region" | "country">} place
 */
export function describePlaceRegion(place) {
  const parts = [place.region, place.country].filter(Boolean);
  return [...new Set(parts)].join("・");
}
