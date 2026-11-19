/**
 * Small runtime guards for untrusted JSON. A malformed response becomes a
 * RequestError of kind "parse" instead of a TypeError deep inside rendering.
 */

import { RequestError } from "./http.js";

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {string} path
 * @param {string} expected
 * @returns {RequestError}
 */
function invalid(path, expected) {
  return new RequestError("parse", `Expected ${path} to be ${expected}.`);
}

/**
 * @param {unknown} value
 * @param {string} path Used in the error message, e.g. "forecast.current".
 * @returns {Record<string, unknown>}
 */
export function requireRecord(value, path) {
  if (!isRecord(value)) throw invalid(path, "an object");
  return value;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {unknown[]}
 */
export function requireArray(value, path) {
  if (!Array.isArray(value)) throw invalid(path, "an array");
  return value;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {string}
 */
export function requireString(value, path) {
  if (typeof value !== "string" || value === "") {
    throw invalid(path, "a non-empty string");
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {number}
 */
export function requireNumber(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw invalid(path, "a finite number");
  }
  return value;
}

/**
 * Open-Meteo uses `null` for missing data points; treat anything that is not
 * a finite number as missing.
 * @param {unknown} value
 * @returns {number | null}
 */
export function optionalNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function optionalString(value) {
  return typeof value === "string" && value !== "" ? value : null;
}
