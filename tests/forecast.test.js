import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildForecastUrl,
  fetchForecast,
  parseForecast,
  roundCoordinate,
} from "../src/api/forecast.js";
import { RequestError } from "../src/api/http.js";
import { fakeFetch, forecastResponse } from "./helpers/fixtures.js";

describe("buildForecastUrl", () => {
  it("requests current, hourly and daily data in the location's time zone", () => {
    const url = buildForecastUrl({
      latitude: 25.033,
      longitude: 121.5654,
      units: "metric",
    });
    const params = url.searchParams;
    assert.equal(
      url.origin + url.pathname,
      "https://api.open-meteo.com/v1/forecast",
    );
    assert.equal(params.get("latitude"), "25.03");
    assert.equal(params.get("longitude"), "121.57");
    assert.equal(params.get("timezone"), "auto");
    assert.equal(params.get("forecast_days"), "7");
    assert.equal(params.get("forecast_hours"), "24");
    assert.equal(params.get("temperature_unit"), "celsius");
    assert.equal(params.get("wind_speed_unit"), "kmh");
    assert.equal(params.get("precipitation_unit"), "mm");
    assert.match(params.get("current") ?? "", /temperature_2m/);
    assert.match(params.get("hourly") ?? "", /precipitation_probability/);
    assert.match(params.get("daily") ?? "", /uv_index_max/);
  });

  it("switches every unit for the imperial system", () => {
    const params = buildForecastUrl({
      latitude: 40.71,
      longitude: -74.01,
      units: "imperial",
      forecastDays: 3,
      hourlySlots: 12,
    }).searchParams;
    assert.equal(params.get("temperature_unit"), "fahrenheit");
    assert.equal(params.get("wind_speed_unit"), "mph");
    assert.equal(params.get("precipitation_unit"), "inch");
    assert.equal(params.get("forecast_days"), "3");
    assert.equal(params.get("forecast_hours"), "12");
  });

  it("keeps a custom base URL, e.g. a proxy", () => {
    const url = buildForecastUrl({
      latitude: 0,
      longitude: 0,
      units: "metric",
      baseUrl: "https://weather-proxy.example.com/v1/forecast?tenant=web",
    });
    assert.equal(url.host, "weather-proxy.example.com");
    assert.equal(url.searchParams.get("tenant"), "web");
  });
});

describe("roundCoordinate", () => {
  it("rounds to about 1 km for privacy", () => {
    assert.equal(roundCoordinate(25.04776), "25.05");
    assert.equal(roundCoordinate(-122.4194), "-122.42");
  });
});

describe("parseForecast", () => {
  it("normalises current conditions", () => {
    const forecast = parseForecast(forecastResponse(), "metric");
    assert.equal(forecast.timezone, "Asia/Taipei");
    assert.equal(forecast.utcOffsetSeconds, 28800);
    assert.equal(forecast.units, "metric");
    assert.deepEqual(forecast.current, {
      time: "2026-11-19T10:45",
      temperature: 17.4,
      weatherCode: 3,
      isDay: true,
      apparentTemperature: 16.8,
      humidity: 79,
      precipitation: 0,
      windSpeed: 9.2,
      windDirection: 45,
      pressure: 1026.1,
    });
  });

  it("starts the hourly forecast at the current hour", () => {
    const { hourly } = parseForecast(forecastResponse(), "metric");
    assert.equal(hourly.length, 24);
    assert.equal(hourly[0].time, "2026-11-19T10:00");
    assert.equal(hourly[23].time, "2026-11-20T09:00");
    assert.equal(hourly[0].precipitationProbability, 10);
    assert.equal(hourly[0].isDay, true);
    assert.equal(hourly[10].isDay, false);
  });

  it("honours the requested number of hourly slots", () => {
    const { hourly } = parseForecast(forecastResponse(), "metric", 6);
    assert.equal(hourly.length, 6);
  });

  it("returns no hours when the data ends before the current time", () => {
    const response = forecastResponse();
    response.current.time = "2026-12-01T00:00";
    assert.deepEqual(parseForecast(response, "metric").hourly, []);
  });

  it("normalises the daily forecast", () => {
    const { daily } = parseForecast(forecastResponse(), "metric");
    assert.equal(daily.length, 7);
    assert.deepEqual(daily[0], {
      date: "2026-11-19",
      weatherCode: 61,
      temperatureMax: 19.2,
      temperatureMin: 13.1,
      precipitationProbability: 100,
      sunrise: "2026-11-19T06:13",
      sunset: "2026-11-19T17:05",
      uvIndexMax: 1.2,
    });
  });

  it("treats null readings and missing columns as missing data", () => {
    const response = forecastResponse();
    response.current.apparent_temperature = null;
    response.current.pressure_msl = undefined;
    response.daily.uv_index_max = undefined;
    response.hourly.temperature_2m[10] = null;
    const forecast = parseForecast(response, "metric");
    assert.equal(forecast.current.apparentTemperature, null);
    assert.equal(forecast.current.pressure, null);
    assert.equal(forecast.daily[0].uvIndexMax, null);
    assert.equal(forecast.hourly[0].temperature, null);
  });

  it("rejects responses without the required fields", () => {
    const missingCurrent = forecastResponse({ current: undefined });
    const badTemperature = forecastResponse();
    badTemperature.current.temperature_2m = "warm";

    for (const response of [null, [], missingCurrent, badTemperature]) {
      assert.throws(
        () => parseForecast(response, "metric"),
        (error) => error instanceof RequestError && error.kind === "parse",
      );
    }
  });
});

describe("fetchForecast", () => {
  it("fetches and parses the forecast for a position", async () => {
    const { fetchImpl, calls } = fakeFetch(forecastResponse());
    const forecast = await fetchForecast(
      { latitude: 25.033, longitude: 121.5654 },
      { units: "metric", hourlySlots: 12, fetchImpl },
    );
    assert.equal(calls.length, 1);
    assert.match(calls[0], /latitude=25\.03&longitude=121\.57/);
    assert.equal(forecast.hourly.length, 12);
  });
});
