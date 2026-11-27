import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GeolocationError,
  getDevicePosition,
  getFreshDevicePosition,
  getLocationPermission,
} from "../src/geolocation.js";

/**
 * @param {(success: Function, failure: Function, options: PositionOptions) => void} behaviour
 */
function fakeGeolocation(behaviour) {
  return {
    getCurrentPosition: (success, failure, options) =>
      behaviour(success, failure, options),
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

describe("getFreshDevicePosition", () => {
  const fix = { coords: { latitude: 22.63, longitude: 120.3 } };

  it("requests new coordinates, preferring the device's precise provider", async () => {
    const calls = [];
    const geolocation = fakeGeolocation((success, _failure, options) => {
      calls.push(options);
      success(fix);
    });
    assert.deepEqual(
      await getFreshDevicePosition({
        timeoutMs: 100,
        retryTimeoutMs: 25,
        maximumAgeMs: 9_999,
        geolocation,
      }),
      fix.coords,
    );
    assert.deepEqual(calls, [
      { enableHighAccuracy: true, timeout: 100, maximumAge: 0 },
    ]);
  });

  it("can recover from a provider timeout or unavailable coordinates", async () => {
    for (const code of [2, 3]) {
      const calls = [];
      const geolocation = fakeGeolocation((success, failure, options) => {
        calls.push(options);
        if (options.enableHighAccuracy) failure({ code });
        else success(fix);
      });
      assert.deepEqual(
        await getFreshDevicePosition({
          timeoutMs: 100,
          retryTimeoutMs: 25,
          geolocation,
        }),
        fix.coords,
      );
      assert.deepEqual(calls, [
        { enableHighAccuracy: true, timeout: 100, maximumAge: 0 },
        { enableHighAccuracy: false, timeout: 25, maximumAge: 0 },
      ]);
    }
  });

  it("never retries after an explicit refusal or an unanswered prompt", async () => {
    let calls = 0;
    const denied = fakeGeolocation((_success, failure) => {
      calls++;
      failure({ code: 1 });
    });
    const ignored = fakeGeolocation(() => calls++);
    const request = { timeoutMs: 100, retryTimeoutMs: 25, guardMs: 10 };
    await assert.rejects(
      getFreshDevicePosition({ ...request, geolocation: denied }),
      hasKind("denied"),
    );
    await assert.rejects(
      getFreshDevicePosition({ ...request, geolocation: ignored }),
      hasKind("timeout"),
    );
    assert.equal(calls, 2);
  });

  it("abandons a late fix after a user selection aborts the request", async () => {
    const controller = new AbortController();
    let fixNow;
    let calls = 0;
    const geolocation = fakeGeolocation((success) => {
      calls++;
      fixNow = () => success(fix);
    });
    const pending = getFreshDevicePosition({
      timeoutMs: 100,
      retryTimeoutMs: 25,
      geolocation,
      signal: controller.signal,
    });
    controller.abort();
    fixNow();
    await assert.rejects(pending, { name: "AbortError" });
    await assert.rejects(
      getDevicePosition({
        timeoutMs: 100,
        signal: controller.signal,
        geolocation,
      }),
      {
        name: "AbortError",
      },
    );
    assert.equal(calls, 1);
  });

  it("does not pass malformed or nonfinite coordinates into the forecast", async () => {
    const geolocation = fakeGeolocation((success) =>
      success({ coords: { latitude: Infinity, longitude: 189 } }),
    );
    await assert.rejects(
      getFreshDevicePosition({
        timeoutMs: 100,
        retryTimeoutMs: 25,
        geolocation,
      }),
      hasKind("unavailable"),
    );
  });

  it("settles if a browser API throws synchronously", async () => {
    const broken = new Error("Location provider threw");
    const geolocation = fakeGeolocation(() => {
      throw broken;
    });
    await assert.rejects(
      getDevicePosition({ timeoutMs: 100, geolocation }),
      broken,
    );
  });
});

describe("getLocationPermission", () => {
  it("reads browser site permission without querying location", async () => {
    const granted = { state: "granted" };
    const permissions = {
      query: async (options) => {
        assert.deepEqual(options, { name: "geolocation" });
        return granted;
      },
    };
    assert.equal(await getLocationPermission(permissions), granted);
  });

  it("treats an unavailable Permissions API as unknown", async () => {
    assert.equal(await getLocationPermission(), null);
    const permissions = {
      query: async () => {
        throw new TypeError("permission descriptor not supported");
      },
    };
    assert.equal(await getLocationPermission(permissions), null);
  });
});
