/**
 * Shared JSDoc type definitions. This module has no runtime code; it exists so
 * TypeScript's `checkJs` can verify the whole app without a build step.
 */

/**
 * Where a place came from: a search result, the device's location, or the
 * built-in fallback.
 * @typedef {"search" | "device" | "default"} PlaceSource
 */

/**
 * @typedef {object} Place
 * @property {string} id Stable identifier, used as a list key.
 * @property {string} name Display name, e.g. "台北".
 * @property {string} [region] First-level administrative area.
 * @property {string} [country] Country name.
 * @property {number} latitude WGS 84 latitude in degrees.
 * @property {number} longitude WGS 84 longitude in degrees.
 * @property {string} [timezone] IANA time zone, e.g. "Asia/Taipei".
 * @property {PlaceSource} source
 */

/**
 * "metric" = °C, km/h, mm; "imperial" = °F, mph, inch.
 * @typedef {"metric" | "imperial"} UnitSystem
 */

/**
 * Current conditions. Secondary readings are nullable because Open-Meteo
 * reports `null` when a model has no value for a location.
 * @typedef {object} CurrentWeather
 * @property {string} time Local wall-clock time, "YYYY-MM-DDTHH:MM".
 * @property {number} temperature
 * @property {number} weatherCode WMO weather interpretation code.
 * @property {boolean} isDay
 * @property {number | null} apparentTemperature
 * @property {number | null} humidity Relative humidity in percent.
 * @property {number | null} precipitation Precipitation of the current interval.
 * @property {number | null} windSpeed
 * @property {number | null} windDirection Degrees the wind blows from (0 = N).
 * @property {number | null} pressure Mean sea-level pressure in hPa.
 */

/**
 * @typedef {object} HourlySlot
 * @property {string} time Local wall-clock time, "YYYY-MM-DDTHH:MM".
 * @property {number | null} temperature
 * @property {number | null} weatherCode
 * @property {number | null} precipitationProbability Percent.
 * @property {boolean} isDay
 */

/**
 * @typedef {object} DailyForecast
 * @property {string} date Local date, "YYYY-MM-DD".
 * @property {number | null} weatherCode
 * @property {number | null} temperatureMax
 * @property {number | null} temperatureMin
 * @property {number | null} precipitationProbability Percent.
 * @property {string | null} sunrise Local wall-clock time.
 * @property {string | null} sunset Local wall-clock time.
 * @property {number | null} uvIndexMax
 */

/**
 * @typedef {object} Forecast
 * @property {string} timezone IANA time zone resolved by the API.
 * @property {string} timezoneAbbreviation e.g. "CST" or "GMT+8".
 * @property {number} utcOffsetSeconds
 * @property {UnitSystem} units
 * @property {CurrentWeather} current
 * @property {HourlySlot[]} hourly Upcoming hours, starting at the current one.
 * @property {DailyForecast[]} daily Starting with today.
 */

/**
 * @typedef {object} Preferences
 * @property {UnitSystem} units
 * @property {Place | null} place A saved place, or null to follow the device.
 */

export {};
