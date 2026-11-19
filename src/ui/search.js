/**
 * Place search as an accessible combobox (WAI-ARIA 1.2 pattern: a text input
 * that controls a listbox popup). Supports keyboard navigation, debounced
 * requests, cancellation of stale requests and CJK input methods.
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
 */

import {
  MIN_QUERY_LENGTH,
  describePlaceRegion,
  normalizeQuery,
} from "../api/geocoding.js";
import { isAbortError } from "../api/http.js";
import { t } from "../i18n.js";
import { createElement, setText } from "./dom.js";

/** @typedef {import("../types.js").Place} Place */

/**
 * @typedef {object} PlaceSearchOptions
 * @property {HTMLFormElement} form
 * @property {HTMLInputElement} input Has role="combobox".
 * @property {HTMLElement} panel Popup container, hidden while closed.
 * @property {HTMLElement} list Has role="listbox".
 * @property {HTMLElement} message Live region for feedback.
 * @property {(query: string, signal: AbortSignal) => Promise<Place[]>} search
 * @property {(place: Place) => void} onSelect
 * @property {number} debounceMs
 */

export class PlaceSearch {
  /** @param {PlaceSearchOptions} options */
  constructor(options) {
    this.options = options;
    /** @type {Place[]} */
    this.results = [];
    this.activeIndex = -1;
    this.resultsQuery = "";
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    this.debounceTimer = undefined;
    /** @type {AbortController | null} */
    this.controller = null;

    const { form, input, panel, list } = options;
    input.addEventListener("input", (event) => {
      // Wait until an input method (e.g. Zhuyin, Pinyin) commits the text.
      if (event instanceof InputEvent && event.isComposing) return;
      this.scheduleSearch();
    });
    input.addEventListener("compositionend", () => this.scheduleSearch());
    input.addEventListener("keydown", (event) => this.handleKeydown(event));
    input.addEventListener("blur", () => this.close());
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.handleSubmit();
    });
    // Keep focus in the input while pressing an option, so the input's blur
    // handler does not close the popup before the click lands.
    panel.addEventListener("mousedown", (event) => event.preventDefault());
    list.addEventListener("click", (event) => {
      const option =
        event.target instanceof Element
          ? event.target.closest("[data-index]")
          : null;
      if (option instanceof HTMLElement) {
        this.select(Number(option.dataset.index));
      }
    });
  }

  get isOpen() {
    return !this.options.panel.hidden;
  }

  scheduleSearch() {
    clearTimeout(this.debounceTimer);
    const query = normalizeQuery(this.options.input.value);
    if (query.length < MIN_QUERY_LENGTH) {
      this.cancel();
      this.setResults([], "");
      this.close();
      return;
    }
    this.debounceTimer = setTimeout(() => {
      void this.run(query);
    }, this.options.debounceMs);
  }

  /** @param {string} query Already normalised. */
  async run(query) {
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    this.showMessage(t("search.searching"));
    this.open();
    try {
      const places = await this.options.search(query, controller.signal);
      if (controller.signal.aborted) return;
      this.setResults(places, query);
      this.showMessage(
        places.length > 0
          ? t("search.count", { count: places.length })
          : t("search.empty", { query }),
      );
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) return;
      this.setResults([], "");
      this.showMessage(t("search.error"));
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }

  /**
   * @param {Place[]} places
   * @param {string} query The query these results answer.
   */
  setResults(places, query) {
    this.results = places;
    this.resultsQuery = query;
    const items = places.map((place, index) => {
      const item = createElement("li", "search-option");
      item.id = `search-option-${index}`;
      item.dataset.index = String(index);
      item.setAttribute("role", "option");
      item.append(
        createElement("span", "search-option-name", place.name),
        createElement(
          "span",
          "search-option-region",
          describePlaceRegion(place),
        ),
      );
      return item;
    });
    this.options.list.replaceChildren(...items);
    this.setActive(places.length > 0 ? 0 : -1);
  }

  /** @param {number} index -1 for none. */
  setActive(index) {
    this.activeIndex = index;
    const { input, list } = this.options;
    for (const option of list.children) {
      const selected = option.id === `search-option-${index}`;
      option.setAttribute("aria-selected", String(selected));
      if (selected) option.scrollIntoView({ block: "nearest" });
    }
    if (index >= 0 && this.isOpen) {
      input.setAttribute("aria-activedescendant", `search-option-${index}`);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  /** @param {KeyboardEvent} event */
  handleKeydown(event) {
    if (event.isComposing) return;
    const count = this.results.length;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (count === 0) return;
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        let start = this.activeIndex;
        if (!this.isOpen) start = step > 0 ? -1 : count;
        this.open();
        this.setActive((start + step + count) % count);
        break;
      }
      case "Escape":
        if (this.isOpen) {
          event.preventDefault();
          this.close();
        } else if (this.options.input.value) {
          event.preventDefault();
          this.options.input.value = "";
          this.cancel();
          this.setResults([], "");
        }
        break;
      default:
        break;
    }
  }

  handleSubmit() {
    const query = normalizeQuery(this.options.input.value);
    const hasFreshResults =
      this.results.length > 0 && query === this.resultsQuery;
    if (hasFreshResults) {
      this.select(Math.max(this.activeIndex, 0));
      return;
    }
    if (query.length < MIN_QUERY_LENGTH) {
      this.setResults([], "");
      this.showMessage(t("search.tooShort", { min: MIN_QUERY_LENGTH }));
      this.open();
      return;
    }
    clearTimeout(this.debounceTimer);
    void this.run(query);
  }

  /** @param {number} index */
  select(index) {
    const place = this.results[index];
    if (!place) return;
    const { input } = this.options;
    this.close();
    input.value = "";
    this.setResults([], "");
    // Dismiss the on-screen keyboard on touch devices to reveal the forecast.
    input.blur();
    this.options.onSelect(place);
  }

  open() {
    this.options.panel.hidden = false;
    this.options.input.setAttribute("aria-expanded", "true");
  }

  close() {
    this.options.panel.hidden = true;
    this.options.input.setAttribute("aria-expanded", "false");
    this.options.input.removeAttribute("aria-activedescendant");
  }

  cancel() {
    clearTimeout(this.debounceTimer);
    this.controller?.abort();
    this.controller = null;
  }

  /** @param {string} text */
  showMessage(text) {
    setText(this.options.message, text);
  }
}
