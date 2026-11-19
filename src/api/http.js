/**
 * Minimal, dependency-free JSON-over-HTTP client with timeouts, cancellation
 * and typed errors. The UI maps `RequestError.kind` to user-facing text, so
 * messages here are developer-oriented English.
 */

/**
 * - "timeout": the request took longer than `timeoutMs`.
 * - "network": the request never got a response (offline, DNS, CORS, …).
 * - "http": the server answered with a non-2xx status.
 * - "parse": the response body was not the JSON we expected.
 * - "aborted": the caller cancelled the request; usually not an error to show.
 * @typedef {"timeout" | "network" | "http" | "parse" | "aborted"} RequestErrorKind
 */

export class RequestError extends Error {
  /**
   * @param {RequestErrorKind} kind
   * @param {string} message
   * @param {{ status?: number, cause?: unknown }} [details]
   */
  constructor(kind, message, details = {}) {
    super(message, { cause: details.cause });
    this.name = "RequestError";
    /** @readonly */
    this.kind = kind;
    /** HTTP status code for kind "http", otherwise null. @readonly */
    this.status = details.status ?? null;
  }
}

/**
 * @param {unknown} error
 * @returns {error is RequestError}
 */
export function isAbortError(error) {
  return error instanceof RequestError && error.kind === "aborted";
}

/**
 * @typedef {object} FetchJsonOptions
 * @property {AbortSignal} [signal] Cancels the request (error kind "aborted").
 * @property {number} [timeoutMs] Defaults to 10 seconds.
 * @property {typeof fetch} [fetchImpl] Injectable for tests.
 */

/**
 * Fetches a URL and parses the body as JSON.
 * @param {string | URL} url
 * @param {FetchJsonOptions} [options]
 * @returns {Promise<unknown>}
 * @throws {RequestError}
 */
export async function fetchJson(url, options = {}) {
  const { signal, timeoutMs = 10_000, fetchImpl = globalThis.fetch } = options;
  if (signal?.aborted) {
    throw new RequestError("aborted", "Request was cancelled.");
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });

  /**
   * Turns a thrown value into a RequestError, preferring the real reason
   * (our timeout or the caller's cancellation) over the generic one.
   * @param {unknown} error
   * @param {RequestErrorKind} fallbackKind
   * @param {string} fallbackMessage
   */
  const classify = (error, fallbackKind, fallbackMessage) => {
    if (timedOut) {
      return new RequestError(
        "timeout",
        `Request timed out after ${timeoutMs} ms.`,
        { cause: error },
      );
    }
    if (signal?.aborted) {
      return new RequestError("aborted", "Request was cancelled.", {
        cause: error,
      });
    }
    return new RequestError(fallbackKind, fallbackMessage, { cause: error });
  };

  try {
    /** @type {Response} */
    let response;
    try {
      response = await fetchImpl(url, { signal: controller.signal });
    } catch (error) {
      throw classify(error, "network", "Network request failed.");
    }

    if (!response.ok) {
      const reason = await readErrorReason(response);
      throw new RequestError(
        "http",
        `HTTP ${response.status}${reason ? `: ${reason}` : ""}`,
        { status: response.status },
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw classify(error, "parse", "Response body is not valid JSON.");
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

/**
 * Open-Meteo reports errors as `{ "error": true, "reason": "…" }`.
 * @param {Response} response
 * @returns {Promise<string>}
 */
async function readErrorReason(response) {
  try {
    const body = await response.json();
    if (body && typeof body === "object" && typeof body.reason === "string") {
      return body.reason;
    }
  } catch {
    // The body is optional diagnostics; ignore anything unreadable.
  }
  return "";
}
