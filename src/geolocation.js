/**
 * Promise wrapper around the Geolocation API with typed failures.
 */

/**
 * @typedef {"insecure" | "unsupported" | "denied" | "unavailable" | "timeout"} GeolocationErrorKind
 */

export class GeolocationError extends Error {
  /**
   * @param {GeolocationErrorKind} kind
   * @param {string} message
   * @param {boolean} [retryable] A completed provider failure, not our prompt guard.
   */
  constructor(kind, message, retryable = false) {
    super(message);
    this.name = "GeolocationError";
    /** @readonly */
    this.kind = kind;
    /** @readonly */
    this.retryable = retryable;
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
 * @property {boolean} [highAccuracy]
 * @property {AbortSignal} [signal]
 * @property {Pick<Geolocation, "getCurrentPosition"> | null} [geolocation]
 *   Injectable for tests; defaults to `navigator.geolocation`.
 */

/**
 * Resolves with the device's position. The API's own timeout excludes waiting
 * for the permission prompt, so a separate guard covers the whole call.
 * @param {PositionRequest} request
 * @returns {Promise<{ latitude: number, longitude: number }>}
 */
export function getDevicePosition(request) {
  const { signal } = request;
  if (signal?.aborted) return Promise.reject(signal.reason);
  if (globalThis.isSecureContext === false) {
    return Promise.reject(
      new GeolocationError(
        "insecure",
        "Geolocation requires a secure context.",
      ),
    );
  }
  const geolocation =
    request.geolocation === undefined
      ? globalThis.navigator?.geolocation
      : request.geolocation;
  if (!geolocation?.getCurrentPosition) {
    return Promise.reject(
      new GeolocationError("unsupported", "Geolocation is not available."),
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const guardMs = request.guardMs ?? request.timeoutMs + 4_000;
    const guard = setTimeout(() => {
      if (finish()) {
        reject(new GeolocationError("timeout", "No position was received."));
      }
    }, guardMs);
    const onAbort = () => {
      if (finish()) reject(signal?.reason);
    };
    function finish() {
      if (settled) return false;
      settled = true;
      clearTimeout(guard);
      signal?.removeEventListener("abort", onAbort);
      return true;
    }
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      geolocation.getCurrentPosition(
        (position) => {
          if (!finish()) return;
          const latitude = position?.coords?.latitude;
          const longitude = position?.coords?.longitude;
          if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            Math.abs(latitude) > 90 ||
            Math.abs(longitude) > 180
          ) {
            reject(
              new GeolocationError(
                "unavailable",
                "Invalid device coordinates.",
                true,
              ),
            );
            return;
          }
          resolve({ latitude, longitude });
        },
        (error) => {
          if (!finish()) return;
          const kind =
            ERROR_KINDS[/** @type {1 | 2 | 3} */ (error.code)] ?? "unavailable";
          reject(
            new GeolocationError(
              kind,
              error.message || kind,
              kind !== "denied",
            ),
          );
        },
        {
          enableHighAccuracy: request.highAccuracy ?? false,
          timeout: request.timeoutMs,
          maximumAge: request.maximumAgeMs ?? 0,
        },
      );
    } catch (error) {
      if (finish()) reject(error);
    }
  });
}

/**
 * Ask for a fresh fix. If the high-accuracy provider reports an acquisition
 * failure, try once more with the standard provider. Do not retry a refused,
 * unsupported, aborted or still-unanswered permission prompt.
 * @param {PositionRequest & { retryTimeoutMs: number }} request
 */
export async function getFreshDevicePosition(request) {
  const positionRequest = { ...request, maximumAgeMs: 0 };
  try {
    return await getDevicePosition({ ...positionRequest, highAccuracy: true });
  } catch (error) {
    if (!(error instanceof GeolocationError) || !error.retryable) throw error;
    return getDevicePosition({
      ...positionRequest,
      timeoutMs: request.retryTimeoutMs,
      guardMs: request.retryTimeoutMs + 2_000,
      highAccuracy: false,
    });
  }
}

/**
 * Reads site permission without prompting. Some mobile browsers don't expose
 * this: the explicit Locate button can still request geolocation there.
 * @param {Pick<Permissions, "query">} [permissions]
 * @returns {Promise<PermissionStatus | null>}
 */
export async function getLocationPermission(
  permissions = globalThis.navigator?.permissions,
) {
  try {
    return (await permissions?.query({ name: "geolocation" })) ?? null;
  } catch {
    return null;
  }
}
