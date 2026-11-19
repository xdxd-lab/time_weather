import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RequestError, fetchJson, isAbortError } from "../src/api/http.js";
import { fakeFetch } from "./helpers/fixtures.js";

/**
 * A fetch that never answers until its signal aborts, like a hung server.
 * @param {string | URL} _url
 * @param {RequestInit} [init]
 */
function hangingFetch(_url, init) {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(new DOMException("The operation was aborted.", "AbortError"));
    });
  });
}

/**
 * @param {RequestError["kind"]} kind
 * @returns {(error: unknown) => boolean}
 */
const hasKind = (kind) => (error) => {
  assert.ok(error instanceof RequestError, "expected a RequestError");
  assert.equal(error.kind, kind);
  return true;
};

describe("fetchJson", () => {
  it("returns the parsed JSON body", async () => {
    const { fetchImpl, calls } = fakeFetch({ ok: 1 });
    const body = await fetchJson("https://example.test/a", { fetchImpl });
    assert.deepEqual(body, { ok: 1 });
    assert.deepEqual(calls, ["https://example.test/a"]);
  });

  it("reports HTTP errors with the status and the API's reason", async () => {
    const { fetchImpl } = fakeFetch(
      { error: true, reason: "Latitude must be in range of -90 to 90°." },
      { status: 400 },
    );
    const request = fetchJson("https://example.test", { fetchImpl });
    await assert.rejects(request, (error) => {
      hasKind("http")(error);
      assert.equal(/** @type {RequestError} */ (error).status, 400);
      assert.match(String(error), /Latitude must be in range/);
      return true;
    });
  });

  it("reports HTTP errors without a JSON body", async () => {
    const { fetchImpl } = fakeFetch("Bad gateway", { status: 502 });
    await assert.rejects(
      fetchJson("https://example.test", { fetchImpl }),
      hasKind("http"),
    );
  });

  it("reports network failures", async () => {
    const fetchImpl = async () => {
      throw new TypeError("fetch failed");
    };
    await assert.rejects(
      fetchJson("https://example.test", { fetchImpl }),
      hasKind("network"),
    );
  });

  it("times out a request that never answers", async () => {
    await assert.rejects(
      fetchJson("https://example.test", {
        fetchImpl: hangingFetch,
        timeoutMs: 20,
      }),
      hasKind("timeout"),
    );
  });

  it("reports caller cancellation as 'aborted'", async () => {
    const controller = new AbortController();
    const request = fetchJson("https://example.test", {
      fetchImpl: hangingFetch,
      signal: controller.signal,
    });
    controller.abort();
    await assert.rejects(request, (error) => isAbortError(error));
  });

  it("does not start a request whose signal is already aborted", async () => {
    const { fetchImpl, calls } = fakeFetch({});
    await assert.rejects(
      fetchJson("https://example.test", {
        fetchImpl,
        signal: AbortSignal.abort(),
      }),
      hasKind("aborted"),
    );
    assert.equal(calls.length, 0);
  });

  it("reports a body that is not JSON", async () => {
    const { fetchImpl } = fakeFetch("<html>maintenance</html>");
    await assert.rejects(
      fetchJson("https://example.test", { fetchImpl }),
      hasKind("parse"),
    );
  });
});
