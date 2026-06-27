// The app's "business day" rolls over at 07:00 IST (not midnight): an instant between
// 00:00 and 06:59 IST still counts as the previous day. We shift the instant back 7h
// and then take its IST calendar date. Dashboards + daily logging use this for "today".
export function istDateStr(d = new Date()): string {
  const shifted = new Date(d.getTime() - 7 * 60 * 60 * 1000);
  return shifted.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
}
export function asUtc(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00Z");
}
export function addDays(dateStr: string, n: number): string {
  const d = asUtc(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function monthBounds(dateStr: string) {
  const d = asUtc(dateStr);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
// last `weeks` Mon-anchored buckets ending at the current week
export function weekBuckets(todayStr: string, weeks: number) {
  const today = asUtc(todayStr);
  const dow = today.getUTCDay(); // 0 Sun..6 Sat
  const offsetToMonday = (dow + 6) % 7;
  const thisMonday = addDays(todayStr, -offsetToMonday);
  const out: { label: string; start: string; end: string }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisMonday, -7 * i);
    const end = addDays(start, 6);
    out.push({ label: start.slice(5), start, end });
  }
  return out;
}
export function inRange(dateStr: string | null, start: string, end: string) {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= start && d <= end;
}

// ---- Deterministic, locale/timezone-independent formatting ----
// `toLocaleDateString(undefined, …)` resolves to the host's locale, which differs between
// the Node server (e.g. en-GB → "23 Jun") and the browser (e.g. en-US → "Jun 23"), causing
// React hydration mismatches. These helpers format the same on server and client.
const WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WD_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Format a YYYY-MM-DD calendar date, e.g. "Tue, Jun 23" / "Tuesday, Jun 23, 2026".
export function prettyDate(dateStr: string, opts: { weekday?: "short" | "long"; year?: boolean } = {}): string {
  const d = asUtc(dateStr.slice(0, 10));
  let s = `${MON_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
  if (opts.year) s += `, ${d.getUTCFullYear()}`;
  if (opts.weekday === "long") s = `${WD_LONG[d.getUTCDay()]}, ${s}`;
  else if (opts.weekday === "short") s = `${WD_SHORT[d.getUTCDay()]}, ${s}`;
  return s;
}

// Short month label from a "YYYY-MM" (or "YYYY-MM-DD") key, e.g. "Jun".
export function monthShort(monthKey: string): string {
  const m = parseInt(monthKey.slice(5, 7), 10);
  return MON_SHORT[m - 1] ?? monthKey;
}
