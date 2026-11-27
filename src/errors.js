/**
 * Maps internal errors to short, actionable messages for the status line.
 * Callers filter cancelled requests before asking for a user-facing message.
 */

import { RequestError } from "./api/http.js";
import { t } from "./i18n.js";

/**
 * @param {unknown} error
 * @param {{ online?: boolean }} [environment] Defaults to `navigator.onLine`.
 * @returns {string}
 */
export function describeError(error, environment = {}) {
  const online = environment.online ?? globalThis.navigator?.onLine ?? true;
  if (!online) return t("status.offline");
  if (error instanceof RequestError) {
    switch (error.kind) {
      case "timeout":
        return t("error.timeout");
      case "network":
        return t("error.network");
      case "http":
        return t("error.http", { status: error.status ?? "?" });
      case "parse":
        return t("error.parse");
      default:
        break;
    }
  }
  return t("error.unknown");
}
