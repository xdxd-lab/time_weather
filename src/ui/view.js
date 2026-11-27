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
    this.hourlyTrend = requireElement("hourly-trend", HTMLElement);
    this.hourlyTrendRange = requireElement("hourly-trend-range", HTMLElement);
    this.hourlyTrendArea = requireElement("hourly-trend-area", SVGPathElement);
    this.hourlyTrendLine = requireElement("hourly-trend-line", SVGPathElement);
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
    this.renderDaily(forecast, place.id);
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
    this.renderHourlyTrend(forecast.hourly);
  }

  /** @param {Forecast["hourly"]} slots */
  renderHourlyTrend(slots) {
    const temps = slots.map((slot) => slot.temperature);
    const values = temps.filter((temperature) => temperature !== null);
    this.hourlyTrend.hidden = values.length < 2;
    if (this.hourlyTrend.hidden) return;
    const low = Math.min(...values);
    const high = Math.max(...values);
    const span = high - low;
    const plotWidth = 240;
    const line = [];
    const area = [];
    let start = null;
    let last = "";
    for (const [index, temperature] of temps.entries()) {
      const x = ((index * plotWidth) / (temps.length - 1)).toFixed(2);
      if (temperature === null) {
        if (start !== null) area.push(`L${last} 44H${start}Z`);
        start = null;
        continue;
      }
      const y =
        span === 0 ? "22" : (38 - ((temperature - low) / span) * 32).toFixed(2);
      const point = `${x} ${y}`;
      if (start === null) {
        start = x;
        area.push(`M${point}`);
        line.push(`M${point}`);
      } else {
        area.push(`L${point}`);
        line.push(`L${point}`);
      }
      last = x;
    }
    if (start !== null) area.push(`L${last} 44H${start}Z`);
    this.hourlyTrendArea.setAttribute("d", area.join(" "));
    this.hourlyTrendLine.setAttribute("d", line.join(" "));
    setText(
      this.hourlyTrendRange,
      t("weather.range", {
        min: formatTemperature(low),
        max: formatTemperature(high),
      }),
    );
  }

  /**
   * @param {Forecast} forecast
   * @param {string} placeId
   */
  renderDaily(forecast, placeId) {
    const days = forecast.daily;
    const today = days[0]?.date ?? "";
    const highs = days.map((day) => day.temperatureMax);
    const lows = days.map((day) => day.temperatureMin);
    const values = [...highs, ...lows].filter(
      (value) => typeof value === "number",
    );
    const floor = Math.min(...values);
    const span = Math.max(...values) - floor || 1;
    const opened =
      this.dailyList.dataset.place === placeId
        ? new Set(
            [...this.dailyList.querySelectorAll("details[open]")].map((entry) =>
              entry.getAttribute("data-date"),
            ),
          )
        : new Set();
    this.dailyList.dataset.place = placeId;

    const items = days.map((day) => {
      const item = createElement("li", "day");
      const disclosure = createElement("details", "day-toggle");
      disclosure.dataset.date = day.date;
      disclosure.open = opened.has(day.date);
      const summary = createElement("summary", "day-summary");
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

      const minimum = createElement("span", "day-min");
      minimum.append(
        visuallyHidden(t("daily.minimum")),
        formatTemperature(day.temperatureMin),
      );
      const maximum = createElement("span", "day-max");
      maximum.append(
        visuallyHidden(t("daily.maximum")),
        formatTemperature(day.temperatureMax),
      );
      const arrow = createElement("span", "day-chevron");
      arrow.setAttribute("aria-hidden", "true");
      summary.append(
        name,
        createWeatherIcon(day.weatherCode, true, "day-icon"),
        precipitationChance(day.precipitationProbability, "day-pop"),
        minimum,
        bar,
        maximum,
        arrow,
      );
      const details = createElement("dl", "day-details");
      for (const [term, value] of [
        [
          t("daily.condition"),
          day.weatherCode === null
            ? PLACEHOLDER
            : describeWeather(day.weatherCode).label,
        ],
        [t("daily.uv"), formatUvIndex(day.uvIndexMax)],
        [t("daily.sunrise"), formatLocalTime(day.sunrise)],
        [t("daily.sunset"), formatLocalTime(day.sunset)],
      ]) {
        const entry = createElement("div");
        entry.append(
          createElement("dt", "", term),
          createElement("dd", "", value),
        );
        details.append(entry);
      }
      disclosure.append(summary, details);
      item.append(disclosure);
      return item;
    });
    this.dailyList.replaceChildren(...items);
  }

  /** Clears weather values after a failure with no data to fall back on. */
  renderUnavailable() {
    this.hourlyTrend.hidden = true;
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
