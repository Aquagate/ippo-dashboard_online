/**
 * Date range presets with Monday-based week boundaries.
 */
export function ymdFromDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayYmd() {
  return ymdFromDate(new Date());
}

export function parseYmd(ymd) {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  if (!matched) {
    return null;
  }
  const date = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return ymdFromDate(date) === `${matched[1]}-${matched[2]}-${matched[3]}` ? date : null;
}

export function shiftYmd(ymd, days) {
  const base = parseYmd(ymd) || new Date();
  const shifted = new Date(base);
  shifted.setDate(shifted.getDate() + days);
  return ymdFromDate(shifted);
}

export function getWeekStartYmd(refYmd = todayYmd()) {
  const date = parseYmd(refYmd) || new Date();
  const weekday = date.getDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + delta);
  return ymdFromDate(date);
}

export function normalizeRange(from, to) {
  const safeFrom = parseYmd(from) ? from : todayYmd();
  const safeTo = parseYmd(to) ? to : todayYmd();
  return safeFrom <= safeTo ? { from: safeFrom, to: safeTo } : { from: safeTo, to: safeFrom };
}

export function getPresetRange(preset) {
  const today = todayYmd();

  if (preset === "today") {
    return { from: today, to: today };
  }
  if (preset === "rolling7") {
    return { from: shiftYmd(today, -6), to: today };
  }
  if (preset === "last_week") {
    const thisWeekStart = getWeekStartYmd(today);
    return { from: shiftYmd(thisWeekStart, -7), to: shiftYmd(thisWeekStart, -1) };
  }
  if (preset === "this_month") {
    const date = parseYmd(today) || new Date();
    date.setDate(1);
    return { from: ymdFromDate(date), to: today };
  }

  return { from: getWeekStartYmd(today), to: today };
}
