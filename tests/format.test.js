import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PLACEHOLDER,
  compassPoint,
  daysBetween,
  formatClock,
  formatDayLabel,
  formatLocalTime,
  formatPercent,
  formatPrecipitation,
  formatPressure,
  formatTemperature,
  formatUtcOffset,
  formatUvIndex,
  formatWind,
  formatWindSpeed,
  formatZoneOffset,
  isValidTimeZone,
} from "../src/format.js";

describe("number formatting", () => {
  it("formats temperatures", () => {
    assert.equal(formatTemperature(17.4), "17°");
    assert.equal(formatTemperature(17.5), "18°");
    assert.equal(formatTemperature(-0.4), "0°", "never shows -0");
    assert.equal(formatTemperature(-3.6), "-4°");
    assert.equal(formatTemperature(17.4, { withUnit: true }), "17°C");
    assert.equal(
      formatTemperature(63.3, { units: "imperial", withUnit: true }),
      "63°F",
    );
    assert.equal(formatTemperature(null), PLACEHOLDER);
    assert.equal(formatTemperature(Number.NaN), PLACEHOLDER);
  });

  it("formats wind speed, precipitation, humidity and pressure", () => {
    assert.equal(formatWindSpeed(9.2, "metric"), "9 km/h");
    assert.equal(formatWindSpeed(5.7, "imperial"), "6 mph");
    assert.equal(formatPrecipitation(0.44, "metric"), "0.4 mm");
    assert.equal(formatPrecipitation(0.021, "imperial"), "0.02 in");
    assert.equal(formatPercent(79.4), "79%");
    assert.equal(formatPressure(1026.1), "1026 hPa");
    assert.equal(formatPressure(null), PLACEHOLDER);
  });
});

describe("wind direction", () => {
  it("maps degrees to eight compass points", () => {
    assert.equal(compassPoint(0), "北");
    assert.equal(compassPoint(22), "北");
    assert.equal(compassPoint(23), "東北");
    assert.equal(compassPoint(90), "東");
    assert.equal(compassPoint(225), "西南");
    assert.equal(compassPoint(359), "北");
    assert.equal(compassPoint(360 + 90), "東");
    assert.equal(compassPoint(-90), "西");
  });

  it("describes wind with the direction it blows from", () => {
    assert.equal(formatWind(9.2, 45, "metric"), "9 km/h 東北風");
    assert.equal(formatWind(0.4, 45, "metric"), "0 km/h", "calm wind");
    assert.equal(formatWind(9.2, null, "metric"), "9 km/h");
  });
});

describe("formatUvIndex", () => {
  it("adds the exposure category", () => {
    assert.equal(formatUvIndex(0), "0（低）");
    assert.equal(formatUvIndex(2.4), "2（低）");
    assert.equal(formatUvIndex(3), "3（中）");
    assert.equal(formatUvIndex(6), "6（高）");
    assert.equal(formatUvIndex(8), "8（過量）");
    assert.equal(formatUvIndex(11.2), "11（危險）");
    assert.equal(formatUvIndex(null), PLACEHOLDER);
  });
});

describe("dates and times", () => {
  it("reads local wall-clock times without time-zone conversion", () => {
    assert.equal(formatLocalTime("2026-11-19T06:13"), "06:13");
    assert.equal(formatLocalTime("2026-11-19"), PLACEHOLDER);
    assert.equal(formatLocalTime(null), PLACEHOLDER);
  });

  it("counts calendar days across month boundaries", () => {
    assert.equal(daysBetween("2026-11-30", "2026-12-01"), 1);
    assert.equal(daysBetween("2026-11-19", "2026-11-19"), 0);
    assert.equal(daysBetween("2026-11-19", "2026-11-25"), 6);
  });

  it("labels days in the daily forecast", () => {
    const today = "2026-11-19";
    assert.deepEqual(formatDayLabel("2026-11-19", today, "zh-TW"), {
      name: "今天",
      date: "11/19",
    });
    assert.deepEqual(formatDayLabel("2026-11-20", today, "zh-TW"), {
      name: "明天",
      date: "11/20",
    });
    assert.deepEqual(formatDayLabel("2026-11-21", today, "zh-TW"), {
      name: "週六",
      date: "11/21",
    });
    assert.equal(formatDayLabel("garbage", today, "zh-TW").name, PLACEHOLDER);
  });

  it("formats the clock in a given time zone", () => {
    const instant = new Date("2026-11-19T02:50:17Z");
    assert.equal(formatClock(instant, "zh-TW", "Asia/Taipei").time, "10:50:17");
    assert.equal(formatClock(instant, "zh-TW", "Asia/Tokyo").time, "11:50:17");
    assert.match(
      formatClock(instant, "zh-TW", "Asia/Taipei").date,
      /2026.*11.*19.*星期四/,
    );
  });

  it("falls back to the device zone for invalid time zones", () => {
    const instant = new Date("2026-11-19T02:50:17Z");
    const { time } = formatClock(instant, "zh-TW", "Not/AZone");
    assert.match(time, /^\d\d:\d\d:\d\d$/);
  });
});

describe("time zones", () => {
  it("validates IANA time zones", () => {
    assert.equal(isValidTimeZone("Asia/Taipei"), true);
    assert.equal(isValidTimeZone("Not/AZone"), false);
    assert.equal(isValidTimeZone(""), false);
    assert.equal(isValidTimeZone(undefined), false);
  });

  it("formats fixed UTC offsets", () => {
    assert.equal(formatUtcOffset(28800), "UTC+8");
    assert.equal(formatUtcOffset(19800), "UTC+5:30");
    assert.equal(formatUtcOffset(-10800), "UTC−3");
    assert.equal(formatUtcOffset(0), "UTC");
  });

  it("formats a zone's current offset, following daylight saving", () => {
    const winter = new Date("2026-01-15T12:00:00Z");
    const summer = new Date("2026-07-15T12:00:00Z");
    assert.equal(formatZoneOffset(winter, "Asia/Tokyo"), "UTC+9");
    assert.equal(formatZoneOffset(winter, "Asia/Kolkata"), "UTC+5:30");
    assert.equal(formatZoneOffset(winter, "America/New_York"), "UTC−5");
    assert.equal(formatZoneOffset(summer, "America/New_York"), "UTC−4");
    assert.equal(formatZoneOffset(winter, "UTC"), "UTC");
    assert.equal(formatZoneOffset(winter, "Not/AZone"), null);
  });
});
