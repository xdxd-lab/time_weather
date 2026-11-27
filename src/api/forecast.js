/**
 * Open-Meteo Forecast API client: builds the request URL and normalises the
 * response into the app's `Forecast` model.
 * @see https://open-meteo.com/en/docs
 */

import { fetchJson } from "./http.js";
import {
  optionalNumber,
  optionalString,
  requireArray,
  requireNumber,
  requireRecord,
  requireString,
} from "./validate.js";

/** @typedef {import("../types.js").Forecast} Forecast */
/** @typedef {import("../types.js").CurrentWeather} CurrentWeather */
/** @typedef {import("../types.js").HourlySlot} HourlySlot */
/** @typedef {import("../types.js").DailyForecast} DailyForecast */
/** @typedef {import("../types.js").UnitSystem} UnitSystem */

export const DEFAULT_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const CURRENT_FIELDS = Object.freeze([
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "is_day",
  "precipitation",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m",
  "pressure_msl",
]);

const HOURLY_FIELDS = Object.freeze([
  "temperature_2m",
  "weather_code",
  "precipitation_probability",
  "is_day",
]);

const DAILY_FIELDS = Object.freeze([
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_probability_max",
  "sunrise",
  "sunset",
  "uv_index_max",
]);

/** @type {Readonly<Record<UnitSystem, Readonly<Record<string, string>>>>} */
const UNIT_PARAMS = Object.freeze({
  metric: Object.freeze({
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
  }),
  imperial: Object.freeze({
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
  }),
});

/**
 * Coordinates are rounded to 2 decimals (about 1 km). That is finer than the
 * weather models' grid, and it avoids sending a precise device position to a
 * third party.
 * @param {number} value
 */
export function roundCoordinate(value) {
  return value.toFixed(2);
}

/**
 * @typedef {object} ForecastQuery
 * @property {number} latitude
 * @property {number} longitude
 * @property {UnitSystem} units
 * @property {number} [forecastDays] 1–16, defaults to 7.
 * @property {number} [hourlySlots] Hourly entries to request, defaults to 24.
 * @property {string} [baseUrl] Override for a proxy or commercial endpoint.
 */

/**
 * @param {ForecastQuery} query
 * @returns {URL}
 */
export function buildForecastUrl(query) {
  const {
    latitude,
    longitude,
    units,
    forecastDays = 7,
    hourlySlots = 24,
  } = query;
  const url = new URL(query.baseUrl ?? DEFAULT_FORECAST_URL);
  const params = url.searchParams;
  params.set("latitude", roundCoordinate(latitude));
  params.set("longitude", roundCoordinate(longitude));
  params.set("current", CURRENT_FIELDS.join(","));
  params.set("hourly", HOURLY_FIELDS.join(","));
  params.set("daily", DAILY_FIELDS.join(","));
  params.set("timezone", "auto");
  params.set("forecast_days", String(forecastDays));
  // Open-Meteo counts the current hour as the first slot. Limit the hourly
  // response independently so the daily panel still receives the full week.
  params.set("forecast_hours", String(hourlySlots));
  for (const [key, value] of Object.entries(UNIT_PARAMS[units])) {
    params.set(key, value);
  }
  return url;
}

/**
 * Validates and normalises a raw Forecast API response.
 * @param {unknown} data Parsed JSON body.
 * @param {UnitSystem} units The unit system the request asked for.
 * @param {number} [hourlySlots] How many upcoming hours to keep.
 * @returns {Forecast}
 * @throws {import("./http.js").RequestError} kind "parse" on malformed data.
 */
export function parseForecast(data, units, hourlySlots = 24) {
  const root = requireRecord(data, "forecast");
  const current = parseCurrent(requireRecord(root.current, "forecast.current"));
  return {
    timezone: optionalString(root.timezone) ?? "UTC",
    timezoneAbbreviation: optionalString(root.timezone_abbreviation) ?? "",
    utcOffsetSeconds: optionalNumber(root.utc_offset_seconds) ?? 0,
    units,
    current,
    hourly: parseHourly(
      requireRecord(root.hourly, "forecast.hourly"),
      current.time,
      hourlySlots,
    ),
    daily: parseDaily(requireRecord(root.daily, "forecast.daily")),
  };
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {CurrentWeather}
 */
function parseCurrent(raw) {
  return {
    time: requireString(raw.time, "forecast.current.time"),
    temperature: requireNumber(
      raw.temperature_2m,
      "forecast.current.temperature_2m",
    ),
    weatherCode: requireNumber(
      raw.weather_code,
      "forecast.current.weather_code",
    ),
    isDay: raw.is_day !== 0,
    apparentTemperature: optionalNumber(raw.apparent_temperature),
    humidity: optionalNumber(raw.relative_humidity_2m),
    precipitation: optionalNumber(raw.precipitation),
    windSpeed: optionalNumber(raw.wind_speed_10m),
    windDirection: optionalNumber(raw.wind_direction_10m),
    pressure: optionalNumber(raw.pressure_msl),
  };
}

/**
 * Keeps `slots` hours starting at the hour that contains `currentTime`.
 * Times are local "YYYY-MM-DDTHH:MM" strings, so they compare correctly as
 * plain strings without any time-zone arithmetic.
 * @param {Record<string, unknown>} raw
 * @param {string} currentTime
 * @param {number} slots
 * @returns {HourlySlot[]}
 */
function parseHourly(raw, currentTime, slots) {
  const times = requireArray(raw.time, "forecast.hourly.time");
  const temperature = column(raw.temperature_2m);
  const weatherCode = column(raw.weather_code);
  const probability = column(raw.precipitation_probability);
  const isDay = column(raw.is_day);
  const currentHour = currentTime.slice(0, 13);

  const start = times.findIndex(
    (time) => typeof time === "string" && time.slice(0, 13) >= currentHour,
  );
  if (start === -1) return [];

  /** @type {HourlySlot[]} */
  const result = [];
  for (let i = start; i < times.length && result.length < slots; i += 1) {
    const time = optionalString(times[i]);
    if (time === null) continue;
    result.push({
      time,
      temperature: optionalNumber(temperature[i]),
      weatherCode: optionalNumber(weatherCode[i]),
      precipitationProbability: optionalNumber(probability[i]),
      isDay: isDay[i] !== 0,
    });
  }
  return result;
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {DailyForecast[]}
 */
function parseDaily(raw) {
  const dates = requireArray(raw.time, "forecast.daily.time");
  const weatherCode = column(raw.weather_code);
  const max = column(raw.temperature_2m_max);
  const min = column(raw.temperature_2m_min);
  const probability = column(raw.precipitation_probability_max);
  const sunrise = column(raw.sunrise);
  const sunset = column(raw.sunset);
  const uvIndex = column(raw.uv_index_max);

  /** @type {DailyForecast[]} */
  const result = [];
  dates.forEach((value, i) => {
    const date = optionalString(value);
    if (date === null) return;
    result.push({
      date,
      weatherCode: optionalNumber(weatherCode[i]),
      temperatureMax: optionalNumber(max[i]),
      temperatureMin: optionalNumber(min[i]),
      precipitationProbability: optionalNumber(probability[i]),
      sunrise: optionalString(sunrise[i]),
      sunset: optionalString(sunset[i]),
      uvIndexMax: optionalNumber(uvIndex[i]),
    });
  });
  return result;
}

/**
 * An optional data column; a missing column reads as all-null.
 * @param {unknown} value
 * @returns {readonly unknown[]}
 */
function column(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * @typedef {object} FetchForecastOptions
 * @property {UnitSystem} units
 * @property {number} [forecastDays]
 * @property {number} [hourlySlots]
 * @property {string} [baseUrl]
 * @property {AbortSignal} [signal]
 * @property {number} [timeoutMs]
 * @property {typeof fetch} [fetchImpl]
 */

/**
 * Fetches and normalises the forecast for a coordinate.
 * @param {{ latitude: number, longitude: number }} position
 * @param {FetchForecastOptions} options
 * @returns {Promise<Forecast>}
 */
export async function fetchForecast(position, options) {
  const url = buildForecastUrl({
    latitude: position.latitude,
    longitude: position.longitude,
    units: options.units,
    forecastDays: options.forecastDays,
    hourlySlots: options.hourlySlots,
    baseUrl: options.baseUrl,
  });
  const data = await fetchJson(url, {
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
  });
  return parseForecast(data, options.units, options.hourlySlots);
}
