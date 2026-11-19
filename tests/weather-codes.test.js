import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { KNOWN_WEATHER_CODES, describeWeather } from "../src/weather-codes.js";

describe("describeWeather", () => {
  it("covers every WMO code documented by Open-Meteo", () => {
    assert.deepEqual(
      [...KNOWN_WEATHER_CODES],
      [
        0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75,
        77, 80, 81, 82, 85, 86, 95, 96, 99,
      ],
    );
  });

  it("gives every known code a label, icon and sky", () => {
    for (const code of KNOWN_WEATHER_CODES) {
      const description = describeWeather(code);
      assert.equal(description.code, code);
      assert.ok(description.label.length > 0, `label for ${code}`);
      assert.ok(description.icon, `icon for ${code}`);
      assert.ok(description.sky, `sky for ${code}`);
    }
  });

  it("maps representative codes", () => {
    assert.deepEqual(describeWeather(0), {
      code: 0,
      label: "晴朗",
      icon: "clear",
      sky: "clear",
    });
    assert.equal(describeWeather(65).label, "大雨");
    assert.equal(describeWeather(95).icon, "thunderstorm");
    assert.equal(describeWeather(75).sky, "snow");
  });

  it("degrades gracefully for unknown codes", () => {
    assert.deepEqual(describeWeather(42), {
      code: 42,
      label: "天氣代碼 42",
      icon: "cloudy",
      sky: "cloudy",
    });
  });
});
