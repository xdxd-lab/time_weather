/**
 * Promise wrapper around the Geolocation API with typed failures.
 */

/**
 * @typedef {"unsupported" | "denied" | "unavailable" | "timeout"} GeolocationErrorKind
 */

export class GeolocationError extends Error {
  /**
   * @param {GeolocationErrorKind} kind
   * @param {string} message
   */
  constructor(kind, message) {
    super(message);
    this.name = "GeolocationError";
    /** @readonly */
    this.kind = kind;
  }
}

/** GeolocationPositionError codes, see the W3C Geolocation spec. */
const ERROR_KINDS = /** @type {const} */ ({
  1: "denied",
  2: "unavailable",
  3: "timeout",
});

/**
 * @typedef {object} PositionRequest
 * @property {number} timeoutMs
 * @property {number} [maximumAgeMs]
 * @property {number} [guardMs] Hard deadline; defaults to timeoutMs + 4 s.
 * @property {Pick<Geolocation, "getCurrentPosition"> | null} [geolocation]
 *   Injectable for tests; defaults to `navigator.geolocation`.
 */

/**
 * Resolves with the device's approximate position.
 *
 * The API's own `timeout` only starts after the user answers the permission
 * prompt, so an ignored prompt would wait forever. A second, slightly longer
 * guard timer makes sure the promise always settles.
 * @param {PositionRequest} request
 * @returns {Promise<{ latitude: number, longitude: number }>}
 */
export function getDevicePosition(request) {
  const geolocation =
    request.geolocation === undefined
      ? globalThis.navigator?.geolocation
      : request.geolocation;
  if (!geolocation) {
    return Promise.reject(
      new GeolocationError("unsupported", "Geolocation is not available."),
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const guardMs = request.guardMs ?? request.timeoutMs + 4_000;
    const guard = setTimeout(() => {
      settled = true;
      reject(new GeolocationError("timeout", "No position was received."));
    }, guardMs);

    geolocation.getCurrentPosition(
      (position) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        const kind =
          ERROR_KINDS[/** @type {1 | 2 | 3} */ (error.code)] ?? "unavailable";
        reject(new GeolocationError(kind, error.message || kind));
      },
      {
        enableHighAccuracy: false,
        timeout: request.timeoutMs,
        maximumAge: request.maximumAgeMs ?? 0,
      },
    );
  });
}
