/**
 * Inline SVG weather icons, drawn on a 32 × 32 grid. Colours come from CSS
 * classes (`.wi-*` in app.css), so the icons follow the light/dark theme and
 * need no inline styles (the Content Security Policy forbids them).
 *
 * The markup is built only from the constants below, never from user or API
 * data, so assigning it with innerHTML is safe.
 */

import { describeWeather } from "../weather-codes.js";

/** @typedef {import("../weather-codes.js").IconKind} IconKind */

const CLOUD =
  "M9 25h14a5.5 5.5 0 1 0-.07-11A7 7 0 1 0 9.07 16a4.5 4.5 0 1 0-.07 9Z";
const MOON = "M14.75 6A10 10 0 1 0 24.79 18.04A8 8 0 0 1 14.75 6Z";
const SUN_RAYS =
  "M16 3.5v3M16 25.5v3M3.5 16h3M25.5 16h3M7.16 7.16l2.12 2.12" +
  "M22.72 22.72l2.12 2.12M7.16 24.84l2.12-2.12M22.72 9.28l2.12-2.12";
const SMALL_SUN_RAYS =
  "M12 2.5v2M3.5 11h2M6 5l1.4 1.4M18 5l-1.4 1.4M6 17l1.4-1.4";

const cloud = (transform = "") =>
  `<path class="wi-cloud"${transform ? ` transform="${transform}"` : ""} d="${CLOUD}"/>`;
const raisedCloud = cloud("translate(0 -4)");

/** @type {Readonly<Record<string, string>>} */
const SHAPES = Object.freeze({
  "clear-day": `<circle class="wi-sun" cx="16" cy="16" r="6"/><path class="wi-rays" d="${SUN_RAYS}"/>`,
  "clear-night": `<path class="wi-moon" d="${MOON}"/>`,
  "partly-cloudy-day": `<circle class="wi-sun" cx="12" cy="11" r="4.5"/><path class="wi-rays" d="${SMALL_SUN_RAYS}"/>${cloud("translate(2 3)")}`,
  "partly-cloudy-night": `<path class="wi-moon" transform="translate(-2 -3) scale(.7)" d="${MOON}"/>${cloud("translate(2 3)")}`,
  cloudy: cloud(),
  fog: `${raisedCloud}<path class="wi-fog" d="M6 25h20M9 29h14"/>`,
  drizzle: `${raisedCloud}<path class="wi-rain" d="M11 25v1.5M17 26.5V28M23 25v1.5"/>`,
  rain: `${raisedCloud}<path class="wi-rain" d="M11.5 24l-1.5 4.5M17.5 24l-1.5 4.5M23.5 24l-1.5 4.5"/>`,
  sleet: `${raisedCloud}<path class="wi-rain" d="M11.5 24l-1.5 4.5M23.5 24l-1.5 4.5"/><circle class="wi-snow" cx="17" cy="27" r="1.6"/>`,
  snow: `${raisedCloud}<circle class="wi-snow" cx="11" cy="25.5" r="1.6"/><circle class="wi-snow" cx="17" cy="28.5" r="1.6"/><circle class="wi-snow" cx="23" cy="25.5" r="1.6"/>`,
  thunderstorm: `${raisedCloud}<path class="wi-bolt" d="M17.5 19l-4.5 6.5h3.5L15 31l5.5-7.5H17l2-4.5Z"/>`,
});

/**
 * @param {IconKind} kind
 * @param {boolean} isDay
 * @returns {string} SVG markup.
 */
export function weatherIconMarkup(kind, isDay) {
  const variant =
    kind === "clear" || kind === "partly-cloudy"
      ? `${kind}-${isDay ? "day" : "night"}`
      : kind;
  const shape = SHAPES[variant] ?? SHAPES.cloudy;
  return `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${shape}</svg>`;
}

/**
 * Creates an icon element announced to screen readers by its condition name.
 * @param {number | null} code WMO weather code; null renders a neutral cloud.
 * @param {boolean} isDay
 * @param {string} [className]
 * @returns {HTMLSpanElement}
 */
export function createWeatherIcon(code, isDay, className = "weather-icon") {
  const span = document.createElement("span");
  span.className = className;
  if (code === null) {
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = weatherIconMarkup("cloudy", isDay);
    return span;
  }
  const description = describeWeather(code);
  span.setAttribute("role", "img");
  span.setAttribute("aria-label", description.label);
  span.innerHTML = weatherIconMarkup(description.icon, isDay);
  return span;
}

/** Small rain-drop glyph shown next to precipitation probabilities. */
export const DROPLET_MARKUP =
  '<svg class="droplet" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<path d="M8 1.5S3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 1.5 8 1.5Z"/></svg>';
