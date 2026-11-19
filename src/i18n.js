/**
 * User-facing strings (Traditional Chinese, Taiwan). Keeping every string in
 * one table makes copy review easy and leaves a single seam for adding more
 * languages later.
 */

const MESSAGES = Object.freeze({
  "clock.local": "現在時間",
  "clock.remote": "當地時間",
  "place.device": "目前位置",
  "place.defaultSuffix": "（預設）",
  "place.locating": "正在取得位置…",
  "status.locating": "正在取得目前位置…",
  "status.loading": "正在更新天氣…",
  "status.updated": "最後更新 {time}",
  "status.stale": "目前顯示 {time} 的資料",
  "status.offline": "目前離線，恢復連線後會自動更新",
  "geo.denied": "未取得定位權限，改為顯示{name}",
  "geo.unavailable": "無法取得目前位置，改為顯示{name}",
  "geo.timeout": "定位逾時，改為顯示{name}",
  "geo.unsupported": "此瀏覽器不支援定位，改為顯示{name}",
  "error.timeout": "天氣服務回應逾時，請稍後再試",
  "error.network": "無法連線到天氣服務，請檢查網路",
  "error.http": "天氣服務暫時無法使用（HTTP {status}）",
  "error.parse": "天氣資料格式異常，請稍後再試",
  "error.unknown": "發生未預期的錯誤，請稍後再試",
  "forecast.unavailable": "暫時沒有預報資料",
  "weather.unavailable": "無法取得天氣",
  "weather.range": "最高 {max}・最低 {min}",
  "weather.windFrom": "{direction}風",
  "weather.precipitationChance": "降雨機率",
  "refresh.idle": "更新天氣",
  "refresh.busy": "更新中…",
  "search.searching": "搜尋中…",
  "search.empty": "找不到「{query}」，試試其他寫法或英文名稱",
  "search.error": "搜尋失敗，請稍後再試",
  "search.count": "找到 {count} 個地點，使用上下鍵選擇",
  "search.tooShort": "請至少輸入 {min} 個字",
  "hourly.now": "現在",
  "daily.today": "今天",
  "daily.tomorrow": "明天",
  "uv.low": "低",
  "uv.moderate": "中",
  "uv.high": "高",
  "uv.veryHigh": "過量",
  "uv.extreme": "危險",
  "document.title": "{temperature} {condition}・{place} — 時間與天氣",
  "document.titleDefault": "時間與天氣 · Time Weather",
});

/** @typedef {keyof typeof MESSAGES} MessageKey */

/**
 * Looks up a message and fills `{name}` placeholders. Unknown placeholders
 * are left as-is so a missing parameter is visible instead of silent.
 * @param {MessageKey} key
 * @param {Record<string, string | number>} [params]
 * @returns {string}
 */
export function t(key, params) {
  const template = MESSAGES[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}
