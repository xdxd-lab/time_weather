/**
 * Pure formatting helpers. Nothing here touches the DOM, so every function is
 * unit-tested in Node.
 */

import { t } from "./i18n.js";

/** @typedef {import("./types.js").UnitSystem} UnitSystem */
/** @typedef {import("./i18n.js").MessageKey} MessageKey */

/** Shown wherever a value is missing. */
export const PLACEHOLDER = "--";

const UNIT_LABELS = Object.freeze({
  metric: Object.freeze({ temperature: "°C", wind: "km/h", rain: "mm" }),
  imperial: Object.freeze({ temperature: "°F", wind: "mph", rain: "in" }),
});

/**
 * @param {number | null | undefined} value
 * @returns {value is number}
 */
function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Rounds to an integer, avoiding the "-0" that Math.round(-0.4) produces.
 * @param {number} value
 */
function roundInteger(value) {
  return Math.round(value) || 0;
}

/**
 * "23°" (compact) or "23°C" (with unit).
 * @param {number | null | undefined} value
 * @param {{ units?: UnitSystem, withUnit?: boolean }} [options]
 */
export function formatTemperature(value, options = {}) {
  const { units = "metric", withUnit = false } = options;
  const suffix = withUnit ? UNIT_LABELS[units].temperature : "°";
  return isNumber(value) ? `${roundInteger(value)}${suffix}` : PLACEHOLDER;
}

/**
 * @param {number | null | undefined} value
 * @param {UnitSystem} units
 */
export function formatWindSpeed(value, units) {
  return isNumber(value)
    ? `${roundInteger(value)} ${UNIT_LABELS[units].wind}`
    : PLACEHOLDER;
}

/**
 * Metric precipitation keeps one decimal (0.4 mm); imperial keeps two
 * (0.02 in), because an inch is 25× larger.
 * @param {number | null | undefined} value
 * @param {UnitSystem} units
 */
export function formatPrecipitation(value, units) {
  if (!isNumber(value)) return PLACEHOLDER;
  const digits = units === "imperial" ? 2 : 1;
  return `${value.toFixed(digits)} ${UNIT_LABELS[units].rain}`;
}

/** @param {number | null | undefined} value */
export function formatPercent(value) {
  return isNumber(value) ? `${roundInteger(value)}%` : PLACEHOLDER;
}

/** @param {number | null | undefined} value Pressure in hPa. */
export function formatPressure(value) {
  return isNumber(value) ? `${roundInteger(value)} hPa` : PLACEHOLDER;
}

const COMPASS_POINTS = Object.freeze([
  "北",
  "東北",
  "東",
  "東南",
  "南",
  "西南",
  "西",
  "西北",
]);

/**
 * Converts degrees to one of eight compass points (0° and 360° are north).
 * @param {number} degrees
 */
export function compassPoint(degrees) {
  const normalized = ((degrees % 360) + 360) % 360;
  return COMPASS_POINTS[Math.round(normalized / 45) % 8];
}

/**
 * "12 km/h 東北風": speed plus the direction the wind blows from.
 * @param {number | null | undefined} speed
 * @param {number | null | undefined} direction Degrees.
 * @param {UnitSystem} units
 */
export function formatWind(speed, direction, units) {
  const speedText = formatWindSpeed(speed, units);
  if (!isNumber(direction) || !isNumber(speed) || speed < 1) return speedText;
  const directionText = t("weather.windFrom", {
    direction: compassPoint(direction),
  });
  return `${speedText} ${directionText}`;
}

/** @type {ReadonlyArray<readonly [number, MessageKey]>} */
const UV_LEVELS = [
  [2, "uv.low"],
  [5, "uv.moderate"],
  [7, "uv.high"],
  [10, "uv.veryHigh"],
];

/**
 * Exposure categories as used by the WHO and Taiwan's Ministry of
 * Environment: 0–2 low, 3–5 moderate, 6–7 high, 8–10 very high, 11+ extreme.
 * @param {number | null | undefined} value
 */
export function formatUvIndex(value) {
  if (!isNumber(value)) return PLACEHOLDER;
  const index = roundInteger(value);
  const level = UV_LEVELS.find(([max]) => index <= max)?.[1] ?? "uv.extreme";
  return `${index}（${t(level)}）`;
}

/**
 * Extracts "HH:MM" from a local "YYYY-MM-DDTHH:MM" timestamp. The API already
 * returns times in the location's own time zone, so no conversion is needed.
 * @param {string | null | undefined} localDateTime
 */
export function formatLocalTime(localDateTime) {
  if (typeof localDateTime !== "string") return PLACEHOLDER;
  const match = /T(\d{2}:\d{2})/.exec(localDateTime);
  return match ? match[1] : PLACEHOLDER;
}

/**
 * Parses "YYYY-MM-DD" as a UTC midnight timestamp (calendar arithmetic only).
 * @param {string} date
 * @returns {number} NaN for invalid input.
 */
function calendarDay(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

const DAY_MS = 86_400_000;

/**
 * Whole days from `fromDate` to `toDate` (both "YYYY-MM-DD").
 * @param {string} fromDate
 * @param {string} toDate
 */
export function daysBetween(fromDate, toDate) {
  return Math.round((calendarDay(toDate) - calendarDay(fromDate)) / DAY_MS);
}

/** @type {Map<string, Intl.DateTimeFormat>} */
const formatterCache = new Map();

/**
 * Intl formatters are relatively expensive to create, and the clock formats
 * every second, so cache them by locale + options.
 * @param {string} locale
 * @param {Intl.DateTimeFormatOptions} options
 */
export function dateTimeFormatter(locale, options) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/** @type {Intl.DateTimeFormatOptions} */
const WEEKDAY_OPTIONS = { weekday: "short", timeZone: "UTC" };

/**
 * Labels for a day in the daily forecast: "今天", "明天", otherwise the short
 * weekday ("週六"), plus a numeric month/day ("11/21").
 * @param {string} date "YYYY-MM-DD" in the location's time zone.
 * @param {string} today "YYYY-MM-DD" in the location's time zone.
 * @param {string} locale
 * @returns {{ name: string, date: string }}
 */
export function formatDayLabel(date, today, locale) {
  const timestamp = calendarDay(date);
  if (Number.isNaN(timestamp)) return { name: PLACEHOLDER, date: "" };
  const utc = new Date(timestamp);
  const monthDay = `${utc.getUTCMonth() + 1}/${utc.getUTCDate()}`;
  const offset = daysBetween(today, date);
  if (offset === 0) return { name: t("daily.today"), date: monthDay };
  if (offset === 1) return { name: t("daily.tomorrow"), date: monthDay };
  const weekday = dateTimeFormatter(locale, WEEKDAY_OPTIONS).format(utc);
  return { name: weekday, date: monthDay };
}

/** @type {Map<string, boolean>} */
const timeZoneValidity = new Map();

/**
 * Whether the runtime's Intl implementation knows an IANA time zone.
 * @param {string | null | undefined} timeZone
 * @returns {timeZone is string}
 */
export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || timeZone === "") return false;
  let valid = timeZoneValidity.get(timeZone);
  if (valid === undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
      valid = true;
    } catch {
      valid = false;
    }
    timeZoneValidity.set(timeZone, valid);
  }
  return valid;
}

/** The device's IANA time zone, e.g. "Asia/Taipei". */
export function deviceTimeZone() {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * "UTC+8", "UTC+5:30", "UTC−3" (with a real minus sign), "UTC".
 * @param {number} offsetSeconds
 */
export function formatUtcOffset(offsetSeconds) {
  if (!Number.isFinite(offsetSeconds) || offsetSeconds === 0) return "UTC";
  const sign = offsetSeconds > 0 ? "+" : "−";
  const totalMinutes = Math.round(Math.abs(offsetSeconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const minuteText = minutes ? `:${String(minutes).padStart(2, "0")}` : "";
  return `UTC${sign}${hours}${minuteText}`;
}

/**
 * Time and long date for the clock, in the given (valid) time zone.
 * @param {Date} now
 * @param {string} locale
 * @param {string} [timeZone] Defaults to the device's time zone.
 * @returns {{ time: string, date: string }}
 */
export function formatClock(now, locale, timeZone) {
  const zone = isValidTimeZone(timeZone) ? { timeZone } : {};
  const time = dateTimeFormatter(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    ...zone,
  }).format(now);
  const date = dateTimeFormatter(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    ...zone,
  }).format(now);
  return { time, date };
}

/**
 * Wall-clock "HH:MM" on this device, for "last updated" messages.
 * @param {Date | number} moment
 * @param {string} locale
 */
export function formatDeviceTime(moment, locale) {
  return dateTimeFormatter(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(moment);
}

/**
 * The current UTC offset of a time zone, e.g. "UTC+9" or "UTC−3:30". Unlike
 * a fixed offset from the API, this follows daylight-saving changes.
 * @param {Date} date
 * @param {string} timeZone
 * @returns {string | null} null if the runtime cannot resolve the zone.
 */
export function formatZoneOffset(date, timeZone) {
  try {
    const parts = dateTimeFormatter("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    const name = parts.find((part) => part.type === "timeZoneName")?.value;
    // "GMT", "GMT+9", "GMT-3:30"; some ICU versions write UTC as "GMT+0".
    const match = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(name ?? "");
    if (!match) return null;
    const [, sign, hours = "0", minutes = "0"] = match;
    const seconds = (Number(hours) * 60 + Number(minutes)) * 60;
    return formatUtcOffset(sign === "-" ? -seconds : seconds);
  } catch {
    return null;
  }
}
