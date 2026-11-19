/**
 * Persists user preferences in Web Storage. Storage can be unavailable
 * (private browsing, disabled cookies, quota errors), so every access is
 * guarded and the app always falls back to defaults instead of crashing.
 *
 * Privacy: only places the user explicitly searched for are saved. A device
 * position is never written to storage.
 */

/** @typedef {import("./types.js").Preferences} Preferences */
/** @typedef {import("./types.js").Place} Place */
/** @typedef {Pick<Storage, "getItem" | "setItem">} KeyValueStore */

/** Versioned so a future format change can migrate or ignore old data. */
export const STORAGE_KEY = "time-weather:preferences:v1";

/** @returns {Preferences} */
export function defaultPreferences() {
  return { units: "metric", place: null };
}

/**
 * Returns `window.localStorage`, or null when the browser blocks it.
 * @returns {KeyValueStore | null}
 */
export function getBrowserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} value
 * @param {number} limit
 */
function isCoordinate(value, limit) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= limit
  );
}

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function optionalText(value) {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Accepts only a well-formed searched place; anything else becomes null.
 * @param {unknown} value
 * @returns {Place | null}
 */
export function sanitizePlace(value) {
  if (typeof value !== "object" || value === null) return null;
  const raw = /** @type {Record<string, unknown>} */ (value);
  const id = optionalText(raw.id);
  const name = optionalText(raw.name);
  if (!id || !name || raw.source !== "search") return null;
  if (!isCoordinate(raw.latitude, 90) || !isCoordinate(raw.longitude, 180)) {
    return null;
  }
  return {
    id,
    name,
    region: optionalText(raw.region),
    country: optionalText(raw.country),
    latitude: /** @type {number} */ (raw.latitude),
    longitude: /** @type {number} */ (raw.longitude),
    timezone: optionalText(raw.timezone),
    source: "search",
  };
}

/**
 * Coerces unknown data (e.g. parsed JSON) into valid preferences.
 * @param {unknown} value
 * @returns {Preferences}
 */
export function sanitizePreferences(value) {
  const preferences = defaultPreferences();
  if (typeof value !== "object" || value === null) return preferences;
  const raw = /** @type {Record<string, unknown>} */ (value);
  if (raw.units === "metric" || raw.units === "imperial") {
    preferences.units = raw.units;
  }
  preferences.place = sanitizePlace(raw.place);
  return preferences;
}

/**
 * @param {KeyValueStore | null} storage
 * @returns {Preferences}
 */
export function loadPreferences(storage) {
  if (!storage) return defaultPreferences();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? sanitizePreferences(JSON.parse(raw)) : defaultPreferences();
  } catch {
    return defaultPreferences();
  }
}

/**
 * @param {KeyValueStore | null} storage
 * @param {Preferences} preferences
 * @returns {boolean} Whether the preferences were written.
 */
export function savePreferences(storage, preferences) {
  if (!storage) return false;
  const place =
    preferences.place?.source === "search" ? preferences.place : null;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ units: preferences.units, place }),
    );
    return true;
  } catch {
    return false;
  }
}
