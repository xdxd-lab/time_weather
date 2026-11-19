import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GeolocationError, getDevicePosition } from "../src/geolocation.js";

/**
 * @param {(success: Function, failure: Function) => void} behaviour
 */
function fakeGeolocation(behaviour) {
  return {
    getCurrentPosition: (success, failure) => behaviour(success, failure),
  };
}

/** @param {string} kind */
const hasKind = (kind) => (error) =>
  error instanceof GeolocationError && error.kind === kind;

describe("getDevicePosition", () => {
  it("resolves with the device's coordinates", async () => {
    const geolocation = fakeGeolocation((success) =>
      success({ coords: { latitude: 22.63, longitude: 120.3 } }),
    );
    const position = await getDevicePosition({ timeoutMs: 100, geolocation });
    assert.deepEqual(position, { latitude: 22.63, longitude: 120.3 });
  });

  it("reports a missing Geolocation API", async () => {
    await assert.rejects(
      getDevicePosition({ timeoutMs: 100, geolocation: null }),
      hasKind("unsupported"),
    );
  });

  it("maps W3C error codes to kinds", async () => {
    const cases = [
      [1, "denied"],
      [2, "unavailable"],
      [3, "timeout"],
      [99, "unavailable"],
    ];
    for (const [code, kind] of cases) {
      const geolocation = fakeGeolocation((_success, failure) =>
        failure({ code, message: "" }),
      );
      await assert.rejects(
        getDevicePosition({ timeoutMs: 100, geolocation }),
        hasKind(kind),
      );
    }
  });

  it("settles even if the permission prompt is ignored", async () => {
    const geolocation = fakeGeolocation(() => {});
    await assert.rejects(
      getDevicePosition({ timeoutMs: 100, guardMs: 10, geolocation }),
      hasKind("timeout"),
    );
  });
});
