/**
 * Application controller: owns the state, talks to the APIs and tells the
 * view what to render. Data flow is one-way: events → state → view.
 */

import { fetchForecast } from "./api/forecast.js";
import { searchPlaces } from "./api/geocoding.js";
import { isAbortError } from "./api/http.js";
import { APP_CONFIG } from "./config.js";
import { describeError } from "./errors.js";
import {
  deviceTimeZone,
  formatDeviceTime,
  formatUtcOffset,
  formatZoneOffset,
  isValidTimeZone,
} from "./format.js";
import { GeolocationError, getDevicePosition } from "./geolocation.js";
import { t } from "./i18n.js";
import {
  getBrowserStorage,
  loadPreferences,
  savePreferences,
} from "./storage.js";
import { requireElement } from "./ui/dom.js";
import { PlaceSearch } from "./ui/search.js";
import { WeatherView } from "./ui/view.js";

/** @typedef {import("./types.js").Forecast} Forecast */
/** @typedef {import("./types.js").Place} Place */
/** @typedef {import("./types.js").Preferences} Preferences */
/** @typedef {import("./types.js").UnitSystem} UnitSystem */
/** @typedef {import("./i18n.js").MessageKey} MessageKey */
/** @typedef {import("./geolocation.js").GeolocationErrorKind} GeoErrorKind */
/** @typedef {import("./ui/view.js").ClockZone} ClockZone */
/** @typedef {typeof APP_CONFIG} AppConfig */

/** @type {Readonly<Record<GeoErrorKind, MessageKey>>} */
const GEO_MESSAGES = Object.freeze({
  denied: "geo.denied",
  unavailable: "geo.unavailable",
  timeout: "geo.timeout",
  unsupported: "geo.unsupported",
});

/** How often the auto-refresh loop checks whether data is due. */
const REFRESH_CHECK_MS = 60_000;

export class App {
  /** @param {AppConfig} [config] */
  constructor(config = APP_CONFIG) {
    this.config = config;
    this.view = new WeatherView(config.locale);
    this.storage = getBrowserStorage();
    /** @type {Preferences} */
    this.preferences = loadPreferences(this.storage);
    /** @type {Place | null} */
    this.place = null;
    /** @type {Forecast | null} */
    this.forecast = null;
    /** Epoch ms of the last successful forecast; 0 = never. */
    this.fetchedAt = 0;
    /** @type {AbortController | null} */
    this.request = null;
    /** Extra context for the status line, e.g. why the fallback is shown. */
    /** @type {string | null} */
    this.notice = null;
    /** Increments on every place change so stale async work can bail out. */
    this.selection = 0;
    this.busy = false;
    this.deviceZone = deviceTimeZone();
    /** @type {ClockZone} */
    this.clockZone = { remote: false, label: "" };
    /** @type {PlaceSearch | null} */
    this.search = null;
  }

  start() {
    this.view.renderUnits(this.preferences.units);
    this.startClock();
    this.bindControls();
    this.startAutoRefresh();
    if (this.preferences.place) {
      void this.showPlace(this.preferences.place);
    } else {
      void this.locate();
    }
  }

  bindControls() {
    const { view, config } = this;
    view.refreshButton.addEventListener("click", () => {
      if (!this.busy) void this.refresh();
    });
    view.locateButton.addEventListener("click", () => void this.locate());
    for (const button of view.unitButtons) {
      button.addEventListener("click", () => {
        const units = button.dataset.units;
        if (units === "metric" || units === "imperial") this.setUnits(units);
      });
    }

    this.search = new PlaceSearch({
      form: requireElement("search-form", HTMLFormElement),
      input: requireElement("search-input", HTMLInputElement),
      panel: requireElement("search-panel", HTMLElement),
      list: requireElement("search-results", HTMLElement),
      message: requireElement("search-message", HTMLElement),
      debounceMs: config.searchDebounceMs,
      search: (query, signal) =>
        searchPlaces(query, {
          signal,
          language: config.geocodingLanguage,
          count: config.searchResultLimit,
          baseUrl: config.geocodingUrl,
          timeoutMs: config.requestTimeoutMs,
        }),
      onSelect: (place) => {
        this.updatePreferences({ place });
        void this.showPlace(place);
      },
    });

    window.addEventListener("online", () => {
      void this.refresh({ background: true });
    });
    window.addEventListener("offline", () => {
      view.renderStatus(t("status.offline"), "warning");
    });
  }

  startClock() {
    const tick = () => {
      this.view.renderClock(new Date(), this.clockZone);
      // Re-align to the next whole second so the display never drifts.
      setTimeout(tick, 1000 - (Date.now() % 1000) + 15);
    };
    tick();
  }

  startAutoRefresh() {
    const { refreshIntervalMs, staleAfterMs } = this.config;
    setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        this.isOlderThan(refreshIntervalMs)
      ) {
        void this.refresh({ background: true });
      }
    }, REFRESH_CHECK_MS);
    document.addEventListener("visibilitychange", () => {
      if (
        document.visibilityState === "visible" &&
        this.isOlderThan(staleAfterMs)
      ) {
        void this.refresh({ background: true });
      }
    });
  }

  /** @param {number} ageMs */
  isOlderThan(ageMs) {
    return (
      this.place !== null && !this.busy && Date.now() - this.fetchedAt >= ageMs
    );
  }

  /** @param {Partial<Preferences>} changes */
  updatePreferences(changes) {
    this.preferences = { ...this.preferences, ...changes };
    savePreferences(this.storage, this.preferences);
  }

  /** @param {UnitSystem} units */
  setUnits(units) {
    if (units === this.preferences.units) return;
    this.updatePreferences({ units });
    this.view.renderUnits(units);
    void this.refresh();
  }

  /**
   * Shows the device's position, or the default place if it is unavailable.
   * Forgets any saved place, because the user chose "my location".
   */
  async locate() {
    const selection = ++this.selection;
    this.request?.abort();
    this.request = null;
    this.updatePreferences({ place: null });
    this.view.renderLocating();
    this.setBusy(true);
    this.view.renderStatus(t("status.locating"));

    /** @type {Place} */
    let place;
    /** @type {string | null} */
    let notice = null;
    try {
      const position = await getDevicePosition({
        timeoutMs: this.config.geolocationTimeoutMs,
        maximumAgeMs: this.config.geolocationMaxAgeMs,
      });
      place = {
        id: "device",
        name: t("place.device"),
        latitude: position.latitude,
        longitude: position.longitude,
        source: "device",
      };
    } catch (error) {
      const kind =
        error instanceof GeolocationError ? error.kind : "unavailable";
      place = this.config.defaultPlace;
      notice = t(GEO_MESSAGES[kind], { name: place.name });
    }
    // The user may have picked a city while we were waiting.
    if (selection !== this.selection) return;
    await this.showPlace(place, notice);
  }

  /**
   * @param {Place} place
   * @param {string | null} [notice]
   */
  async showPlace(place, notice = null) {
    this.selection += 1;
    this.place = place;
    this.notice = notice;
    // Never show one place's numbers under another place's name.
    this.forecast = null;
    this.fetchedAt = 0;
    this.view.renderPlace(place);
    if (place.timezone) this.setClockZone(place.timezone, null);
    await this.refresh();
  }

  /**
   * @param {string} timeZone
   * @param {number | null} fallbackOffsetSeconds Used if Intl cannot tell.
   */
  setClockZone(timeZone, fallbackOffsetSeconds) {
    const now = new Date();
    if (!isValidTimeZone(timeZone) || timeZone === this.deviceZone) {
      this.clockZone = { remote: false, label: "" };
    } else {
      const fallback =
        fallbackOffsetSeconds === null
          ? timeZone
          : formatUtcOffset(fallbackOffsetSeconds);
      const label = formatZoneOffset(now, timeZone) ?? fallback;
      this.clockZone = { timeZone, remote: true, label };
    }
    this.view.renderClock(now, this.clockZone);
  }

  /**
   * Loads the forecast for the current place. Starting a new request cancels
   * the previous one, so out-of-order responses can never overwrite newer data.
   * @param {{ background?: boolean }} [options] Background refreshes keep the
   *   current status text until they finish.
   */
  async refresh(options = {}) {
    const place = this.place;
    if (!place) return;
    this.request?.abort();
    const controller = new AbortController();
    this.request = controller;
    this.setBusy(true);
    if (!options.background) this.view.renderStatus(t("status.loading"));

    try {
      const forecast = await fetchForecast(place, {
        units: this.preferences.units,
        forecastDays: this.config.forecastDays,
        hourlySlots: this.config.hourlySlots,
        baseUrl: this.config.forecastUrl,
        timeoutMs: this.config.requestTimeoutMs,
        signal: controller.signal,
      });
      if (controller !== this.request) return;
      this.forecast = forecast;
      this.fetchedAt = Date.now();
      this.setClockZone(forecast.timezone, forecast.utcOffsetSeconds);
      this.view.renderForecast(forecast, place);
      this.view.renderStatus(this.statusMessage());
    } catch (error) {
      if (isAbortError(error) || controller !== this.request) return;
      console.error("[time-weather] Forecast request failed:", error);
      const parts = [describeError(error)];
      if (this.forecast) {
        const time = formatDeviceTime(this.fetchedAt, this.config.locale);
        parts.push(t("status.stale", { time }));
      } else {
        this.view.renderUnavailable();
      }
      this.view.renderStatus(parts.join("・"), "error");
    } finally {
      if (controller === this.request) {
        this.request = null;
        this.setBusy(false);
      }
    }
  }

  statusMessage() {
    const time = formatDeviceTime(this.fetchedAt, this.config.locale);
    const updated = t("status.updated", { time });
    return this.notice ? `${updated}・${this.notice}` : updated;
  }

  /** @param {boolean} busy */
  setBusy(busy) {
    this.busy = busy;
    this.view.setBusy(busy);
  }
}
