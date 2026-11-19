/**
 * Tiny DOM helpers with type-safe element lookup.
 */

/**
 * Returns the element with `id`, verifying its type. Failing fast here turns
 * a template/script mismatch into one clear error at startup.
 * @template {Element} T
 * @param {string} id
 * @param {abstract new (...args: never[]) => T} type e.g. HTMLButtonElement
 * @returns {T}
 */
export function requireElement(id, type) {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`Expected #${id} to be a ${type.name}.`);
  }
  return element;
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElementTagNameMap[K]}
 */
export function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/**
 * Sets text only when it changed, avoiding needless DOM mutations (and
 * repeated screen-reader announcements inside live regions).
 * @param {Node} node
 * @param {string} text
 */
export function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

/**
 * Text that is read by screen readers but not shown.
 * @param {string} text
 */
export function visuallyHidden(text) {
  return createElement("span", "visually-hidden", text);
}
