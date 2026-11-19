import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeError } from "../src/errors.js";
import { RequestError } from "../src/api/http.js";
import { t } from "../src/i18n.js";

describe("t", () => {
  it("returns plain messages", () => {
    assert.equal(t("hourly.now"), "現在");
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    assert.equal(t("status.updated", { time: "10:48" }), "最後更新 10:48");
    assert.equal(t("search.empty", {}), t("search.empty"));
    assert.match(t("search.empty", {}), /\{query\}/);
  });
});

describe("describeError", () => {
  it("explains each request failure", () => {
    const online = { online: true };
    const message = (kind, status) =>
      describeError(new RequestError(kind, "x", { status }), online);
    assert.equal(message("timeout"), "天氣服務回應逾時，請稍後再試");
    assert.equal(message("network"), "無法連線到天氣服務，請檢查網路");
    assert.equal(message("http", 503), "天氣服務暫時無法使用（HTTP 503）");
    assert.equal(message("parse"), "天氣資料格式異常，請稍後再試");
    assert.equal(describeError(new Error("boom"), online), t("error.unknown"));
  });

  it("prefers the offline explanation when the browser is offline", () => {
    const error = new RequestError("network", "x");
    assert.equal(describeError(error, { online: false }), t("status.offline"));
  });
});
