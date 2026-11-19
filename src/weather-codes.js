/**
 * WMO weather interpretation codes (WW) as returned by Open-Meteo, mapped to
 * Traditional Chinese labels, an icon kind and a background "sky" theme.
 * @see https://open-meteo.com/en/docs (section "WMO Weather interpretation codes")
 */

/**
 * Icon drawn for a condition. "clear" and "partly-cloudy" have night variants.
 * @typedef {"clear" | "partly-cloudy" | "cloudy" | "fog" | "drizzle" | "rain"
 *   | "sleet" | "snow" | "thunderstorm"} IconKind
 */

/**
 * Background theme for a condition.
 * @typedef {"clear" | "cloudy" | "fog" | "rain" | "snow" | "storm"} SkyKind
 */

/**
 * @typedef {object} WeatherDescription
 * @property {number} code
 * @property {string} label
 * @property {IconKind} icon
 * @property {SkyKind} sky
 */

/** @type {Readonly<Record<number, readonly [string, IconKind, SkyKind]>>} */
const WMO_CODES = Object.freeze({
  0: ["晴朗", "clear", "clear"],
  1: ["大致晴朗", "clear", "clear"],
  2: ["局部多雲", "partly-cloudy", "cloudy"],
  3: ["陰天", "cloudy", "cloudy"],
  45: ["有霧", "fog", "fog"],
  48: ["霧凇", "fog", "fog"],
  51: ["微毛毛雨", "drizzle", "rain"],
  53: ["毛毛雨", "drizzle", "rain"],
  55: ["較強毛毛雨", "drizzle", "rain"],
  56: ["凍毛毛雨", "sleet", "rain"],
  57: ["強凍毛毛雨", "sleet", "rain"],
  61: ["小雨", "rain", "rain"],
  63: ["中雨", "rain", "rain"],
  65: ["大雨", "rain", "rain"],
  66: ["凍雨", "sleet", "rain"],
  67: ["強凍雨", "sleet", "rain"],
  71: ["小雪", "snow", "snow"],
  73: ["中雪", "snow", "snow"],
  75: ["大雪", "snow", "snow"],
  77: ["雪粒", "snow", "snow"],
  80: ["陣雨", "rain", "rain"],
  81: ["較強陣雨", "rain", "rain"],
  82: ["猛烈陣雨", "rain", "storm"],
  85: ["陣雪", "snow", "snow"],
  86: ["強陣雪", "snow", "snow"],
  95: ["雷雨", "thunderstorm", "storm"],
  96: ["雷雨伴冰雹", "thunderstorm", "storm"],
  99: ["強雷雨伴冰雹", "thunderstorm", "storm"],
});

/** Every code this module knows (integer keys enumerate in ascending order). */
export const KNOWN_WEATHER_CODES = Object.freeze(
  Object.keys(WMO_CODES).map(Number),
);

/**
 * Describes a WMO weather code. Unknown codes degrade gracefully instead of
 * throwing, because the API may add codes in the future.
 * @param {number} code
 * @returns {WeatherDescription}
 */
export function describeWeather(code) {
  const entry = WMO_CODES[code];
  if (!entry) {
    return { code, label: `天氣代碼 ${code}`, icon: "cloudy", sky: "cloudy" };
  }
  const [label, icon, sky] = entry;
  return { code, label, icon, sky };
}
