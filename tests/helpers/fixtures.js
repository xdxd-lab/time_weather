/**
 * Builders for realistic API responses, shaped like real Open-Meteo output.
 */

/**
 * Hourly timestamps for two local days, starting 2026-11-19T00:00.
 * @returns {string[]}
 */
function hourlyTimes() {
  const times = [];
  for (let index = 0; index < 48; index += 1) {
    const day = 19 + Math.floor(index / 24);
    const hour = String(index % 24).padStart(2, "0");
    times.push(`2026-11-${day}T${hour}:00`);
  }
  return times;
}

/** @param {number} index Hours since local midnight on the first day. */
const isDaytime = (index) => (index % 24 >= 6 && index % 24 < 18 ? 1 : 0);

const DAYS = [
  "2026-11-19",
  "2026-11-20",
  "2026-11-21",
  "2026-11-22",
  "2026-11-23",
  "2026-11-24",
  "2026-11-25",
];

/**
 * A Forecast API response for Taipei at 2026-11-19 10:45 local time.
 * @param {Record<string, unknown>} [overrides] Shallow overrides of the root.
 */
export function forecastResponse(overrides = {}) {
  const times = hourlyTimes();
  return {
    latitude: 25.03,
    longitude: 121.57,
    generationtime_ms: 0.12,
    utc_offset_seconds: 28800,
    timezone: "Asia/Taipei",
    timezone_abbreviation: "GMT+8",
    elevation: 9,
    current: {
      time: "2026-11-19T10:45",
      interval: 900,
      temperature_2m: 17.4,
      relative_humidity_2m: 79,
      apparent_temperature: 16.8,
      is_day: 1,
      precipitation: 0,
      weather_code: 3,
      wind_speed_10m: 9.2,
      wind_direction_10m: 45,
      pressure_msl: 1026.1,
    },
    hourly: {
      time: times,
      temperature_2m: times.map((_, index) => 15 + (index % 10)),
      weather_code: times.map(() => 61),
      precipitation_probability: times.map((_, index) => index),
      is_day: times.map((_, index) => isDaytime(index)),
    },
    daily: {
      time: DAYS,
      weather_code: [61, 3, 3, 0, 2, 61, 80],
      temperature_2m_max: [19.2, 19, 20.4, 22, 27.1, 25, 18],
      temperature_2m_min: [13.1, 13, 12.2, 14, 17, 17, 16],
      precipitation_probability_max: [100, 4, 0, 2, 0, 73, 59],
      sunrise: DAYS.map((day) => `${day}T06:13`),
      sunset: DAYS.map((day) => `${day}T17:05`),
      uv_index_max: [1.2, 3.4, 5, 6.1, 7.9, 2, 0.4],
    },
    ...overrides,
  };
}

/** A Geocoding API response for the query "Tokyo" with language "zh". */
export function geocodingResponse() {
  return {
    results: [
      {
        id: 1850147,
        name: "東京",
        latitude: 35.6895,
        longitude: 139.69171,
        elevation: 44,
        feature_code: "PPLC",
        country_code: "JP",
        timezone: "Asia/Tokyo",
        population: 8336599,
        country: "日本",
        admin1: "東京都",
      },
      { id: 2, name: "Broken entry without coordinates" },
      "not an object",
      {
        id: 1668341,
        name: "台北市",
        latitude: 25.04776,
        longitude: 121.53185,
        timezone: "Asia/Taipei",
        country: "台湾",
        admin1: "臺灣省 or 台灣省",
      },
    ],
    generationtime_ms: 0.8,
  };
}

/**
 * A fake `fetch` that records requests and answers with `body`.
 * @param {unknown} body
 * @param {ResponseInit} [init]
 */
export function fakeFetch(body, init = { status: 200 }) {
  /** @type {string[]} */
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return new Response(text, {
      headers: { "content-type": "application/json" },
      ...init,
    });
  };
  return { fetchImpl, calls };
}
