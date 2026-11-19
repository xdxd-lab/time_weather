/**
 * The view layer: turns app state into DOM updates. It holds no state of its
 * own beyond element references, and it never fetches data.
 */

import { describePlaceRegion } from "../api/geocoding.js";
import {
  PLACEHOLDER,
  formatClock,
  formatDayLabel,
  formatLocalTime,
  formatPercent,
  formatPrecipitation,
  formatPressure,
  formatTemperature,
  formatUvIndex,
  formatWind,
} from "../format.js";
import { t } from "../i18n.js";
import { describeWeather } from "../weather-codes.js";
import {
  createElement,
  requireElement,
  setText,
  visuallyHidden,
} from "./dom.js";
import { DROPLET_MARKUP, createWeatherIcon } from "./icons.js";

/** @typedef {import("../types.js").Forecast} Forecast */
/** @typedef {import("../types.js").Place} Place */
/** @typedef {import("../types.js").UnitSystem} UnitSystem */

/**
 * @typedef {object} ClockZone
 * @property {string} [timeZone] IANA zone to display; undefined = device.
 * @property {boolean} remote Whether it differs from the device's zone.
 * @property {string} label e.g. "UTC+9", or "" for the device's own zone.
 */

/** @typedef {"info" | "warning" | "error"} StatusTone */

export class WeatherView {
  /** @param {string} locale */
  constructor(locale) {
    this.locale = locale;
    this.root = document.body;
    this.hero = requireElement("hero", HTMLElement);
    this.clockLabel = requireElement("clock-label", HTMLElement);
    this.clockZone = requireElement("clock-zone", HTMLElement);
    this.clockTime = requireElement("clock-time", HTMLElement);
    this.clockDate = requireElement("clock-date", HTMLElement);
    this.placeName = requireElement("place-name", HTMLElement);
    this.placeRegion = requireElement("place-region", HTMLElement);
    this.conditionIcon = requireElement("condition-icon", HTMLElement);
    this.conditionText = requireElement("condition-text", HTMLElement);
    this.temperature = requireElement("temperature", HTMLElement);
    this.temperatureRange = requireElement("temperature-range", HTMLElement);
    this.detailFeels = requireElement("detail-feels", HTMLElement);
    this.detailHumidity = requireElement("detail-humidity", HTMLElement);
    this.detailWind = requireElement("detail-wind", HTMLElement);
    this.detailPrecipitation = requireElement(
      "detail-precipitation",
      HTMLElement,
    );
    this.detailUv = requireElement("detail-uv", HTMLElement);
    this.detailPressure = requireElement("detail-pressure", HTMLElement);
    this.detailSunrise = requireElement("detail-sunrise", HTMLElement);
    this.detailSunset = requireElement("detail-sunset", HTMLElement);
    this.status = requireElement("status", HTMLElement);
    this.refreshButton = requireElement("refresh-button", HTMLButtonElement);
    this.locateButton = requireElement("locate-button", HTMLButtonElement);
    this.hourlyList = requireElement("hourly-list", HTMLOListElement);
    this.dailyList = requireElement("daily-list", HTMLOListElement);
    this.unitButtons = [
      requireElement("units-metric", HTMLButtonElement),
      requireElement("units-imperial", HTMLButtonElement),
    ];
  }

  /**
   * Called every second; only touches nodes whose text changed.
   * @param {Date} now
   * @param {ClockZone} zone
   */
  renderClock(now, zone) {
    const { time, date } = formatClock(now, this.locale, zone.timeZone);
    setText(this.clockTime, time);
    setText(this.clockDate, date);
    setText(
      this.clockLabel,
      zone.remote ? t("clock.remote") : t("clock.local"),
    );
    setText(this.clockZone, zone.label);
  }

  /** @param {Place} place */
  renderPlace(place) {
    const name =
      place.source === "default"
        ? `${place.name}${t("place.defaultSuffix")}`
        : place.name;
    setText(this.placeName, name);
    setText(this.placeRegion, describePlaceRegion(place));
  }

  /** Shown while waiting for the device's position. */
  renderLocating() {
    setText(this.placeName, t("place.locating"));
    setText(this.placeRegion, "");
  }

  /**
   * @param {Forecast} forecast
   * @param {Place} place
   */
  renderForecast(forecast, place) {
    const { current, units } = forecast;
    const today = forecast.daily[0];
    const weather = describeWeather(current.weatherCode);

    this.root.dataset.sky = weather.sky;
    this.root.dataset.daylight = current.isDay ? "day" : "night";

    this.conditionIcon.replaceChildren(
      createWeatherIcon(current.weatherCode, current.isDay, "condition-glyph"),
    );
    setText(this.conditionText, weather.label);
    setText(this.temperature, formatTemperature(current.temperature));
    setText(
      this.temperatureRange,
      today
        ? t("weather.range", {
            max: formatTemperature(today.temperatureMax),
            min: formatTemperature(today.temperatureMin),
          })
        : "",
    );

    setText(
      this.detailFeels,
      formatTemperature(current.apparentTemperature, { units, withUnit: true }),
    );
    setText(this.detailHumidity, formatPercent(current.humidity));
    setText(
      this.detailWind,
      formatWind(current.windSpeed, current.windDirection, units),
    );
    setText(
      this.detailPrecipitation,
      formatPrecipitation(current.precipitation, units),
    );
    setText(this.detailUv, formatUvIndex(today?.uvIndexMax));
    setText(this.detailPressure, formatPressure(current.pressure));
    setText(this.detailSunrise, formatLocalTime(today?.sunrise));
    setText(this.detailSunset, formatLocalTime(today?.sunset));

    this.renderHourly(forecast);
    this.renderDaily(forecast);
    document.title = t("document.title", {
      temperature: formatTemperature(current.temperature),
      condition: weather.label,
      place: place.name,
    });
  }

  /** @param {Forecast} forecast */
  renderHourly(forecast) {
    const items = forecast.hourly.map((slot, index) => {
      const item = createElement("li", "hour");
      const label = index === 0 ? t("hourly.now") : formatLocalTime(slot.time);
      item.append(
        createElement("span", "hour-time", label),
        createWeatherIcon(slot.weatherCode, slot.isDay, "hour-icon"),
        createElement("span", "hour-temp", formatTemperature(slot.temperature)),
        precipitationChance(slot.precipitationProbability, "hour-pop"),
      );
      return item;
    });
    this.hourlyList.replaceChildren(...items);
  }

  /** @param {Forecast} forecast */
  renderDaily(forecast) {
    const days = forecast.daily;
    const today = days[0]?.date ?? "";
    const highs = days.map((day) => day.temperatureMax);
    const lows = days.map((day) => day.temperatureMin);
    const values = [...highs, ...lows].filter(
      (value) => typeof value === "number",
    );
    const floor = Math.min(...values);
    const span = Math.max(...values) - floor || 1;

    const items = days.map((day) => {
      const item = createElement("li", "day");
      const label = formatDayLabel(day.date, today, this.locale);
      const name = createElement("span", "day-name", label.name);
      name.append(createElement("span", "day-date", label.date));

      const bar = createElement("span", "range");
      bar.setAttribute("aria-hidden", "true");
      if (day.temperatureMin !== null && day.temperatureMax !== null) {
        const fill = createElement("span", "range-fill");
        const start = ((day.temperatureMin - floor) / span) * 100;
        const end = ((day.temperatureMax - floor) / span) * 100;
        // CSSOM property writes are allowed under the CSP; style="" is not.
        fill.style.setProperty("--range-start", `${start.toFixed(1)}%`);
        fill.style.setProperty("--range-end", `${end.toFixed(1)}%`);
        bar.append(fill);
      }

      item.append(
        name,
        createWeatherIcon(day.weatherCode, true, "day-icon"),
        precipitationChance(day.precipitationProbability, "day-pop"),
        createElement("span", "day-min", formatTemperature(day.temperatureMin)),
        bar,
        createElement("span", "day-max", formatTemperature(day.temperatureMax)),
      );
      return item;
    });
    this.dailyList.replaceChildren(...items);
  }

  /** Clears weather values after a failure with no data to fall back on. */
  renderUnavailable() {
    this.conditionIcon.replaceChildren();
    setText(this.conditionText, t("weather.unavailable"));
    setText(this.temperature, `${PLACEHOLDER}°`);
    setText(this.temperatureRange, "");
    for (const node of [
      this.detailFeels,
      this.detailHumidity,
      this.detailWind,
      this.detailPrecipitation,
      this.detailUv,
      this.detailPressure,
      this.detailSunrise,
      this.detailSunset,
    ]) {
      setText(node, PLACEHOLDER);
    }
    for (const list of [this.hourlyList, this.dailyList]) {
      list.replaceChildren(
        createElement("li", "list-placeholder", t("forecast.unavailable")),
      );
    }
    document.title = t("document.titleDefault");
  }

  /**
   * @param {string} message
   * @param {StatusTone} [tone]
   */
  renderStatus(message, tone = "info") {
    setText(this.status, message);
    this.status.dataset.tone = tone;
  }

  /**
   * Marks the weather area busy. The button stays focusable (aria-disabled
   * rather than disabled) so keyboard focus is not lost mid-refresh.
   * @param {boolean} busy
   */
  setBusy(busy) {
    this.hero.setAttribute("aria-busy", String(busy));
    this.refreshButton.setAttribute("aria-disabled", String(busy));
    setText(this.refreshButton, busy ? t("refresh.busy") : t("refresh.idle"));
  }

  /** @param {UnitSystem} units */
  renderUnits(units) {
    for (const button of this.unitButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.units === units),
      );
    }
  }
}

/**
 * "💧 20%" with an accessible label; empty when the value is unknown.
 * @param {number | null} probability
 * @param {string} className
 */
function precipitationChance(probability, className) {
  const element = createElement("span", className);
  if (probability === null) return element;
  element.innerHTML = DROPLET_MARKUP;
  element.append(
    visuallyHidden(t("weather.precipitationChance")),
    formatPercent(probability),
  );
  return element;
}
