import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/",
      "coverage/",
      "playwright-report/",
      "test-results/",
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      curly: ["error", "multi-line"],
      eqeqeq: ["error", "always"],
      "no-console": ["error", { allow: ["error", "warn", "info"] }],
      "no-implicit-coercion": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-const": "error",
    },
  },
  {
    files: ["src/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["tests/**/*.js", "scripts/**/*.mjs", "*.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    // Playwright specs run in Node, but page.evaluate() callbacks run in the
    // browser.
    files: ["e2e/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
