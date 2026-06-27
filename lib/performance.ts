import type { SupabaseClient } from "@supabase/supabase-js";
import { istDateStr, monthBounds, addDays, inRange } from "@/lib/dates";

// ---------- shared types ----------
export type MonthCell = { month: string; subTarget: number | null; subActual: number; subPct: number | null; clTarget: number | null; clActual: number; clPct: number | null };
export type Pace = "ahead" | "on" | "behind" | "none";
export type Pacing = {
  subTarget: number | null; subActual: number; subProjected: number; subPace: Pace;
  clTarget: number | null; clActual: number; clProjected: number; clPace: Pace;
  fractionElapsed: number; daysLeft: number;
};
export type PerfRow = {
  id: string; name: string;
  pacing: Pacing;
  scorecard: MonthCell[];
  timeToFirstSub: number | null;   // avg days, allocation -> first submission
  timeToClosure: number | null;    // avg days, submission -> closure
  convClientPct: number; convInterviewPct: number; convClosurePct: number; // this-month funnel
  sourced: number; subsPer100: number | null; closuresPer100: number | null;
  activeDays: number; streak: number;
  score: number; rank: number;
  subVsMedian: "above" | "below" | "even"; clVsMedian: "above" | "below" | "even";
};
export type StageDwell = { stage: string; avgDays: number; n: number };
export type ConvPoint = { month: string; submitted: number; clientPct: number; interviewPct: number; closurePct: number };
export type TeamPerf = {
  recruiters: PerfRow[];
  subMedian: number; clMedian: number;
  stageDwell: StageDwell[];
  convTrend: ConvPoint[];
  weights: { submissions: number; closures: number; active_days: number };
};

// ---------- helpers ----------
const monthKey = (d: string) => d.slice(0, 7);
function lastMonthKeys(today: string, n: number): string[] {
  const keys: string[] = [];
  let cur = today;
  for (let i = 0; i < n; i++) { keys.unshift(monthKey(cur)); const { start } = monthBounds(cur); cur = addDays(start, -1); }
  return keys;
}
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function paceOf(actual: number, target: number | null, frac: number): Pace {
  if (target == null || target === 0) return "none";
  const expected = target * frac;
  if (expected <= 0) return "on";
  const r = actual / expected;
  return r >= 1.05 ? "ahead" : r <= 0.9 ? "behind" : "on";
}
function projected(actual: number, frac: number): number {
  return frac > 0 ? Math.round(actual / frac) : actual;
}

// Resolve a recruiter's target for a month: explicit goal first, else profile fallback.
function targetFor(goals: Map<string, { sub: number | null; cl: number | null }>, month: string, fb: { sub: number | null; cl: number | null }) {
  const g = goals.get(month);
  return { sub: g?.sub ?? fb.sub ?? null, cl: g?.cl ?? fb.cl ?? null };
}

// =============================================================
// Team-wide performance (manager view). One pass over the data.
// =============================================================
export async function computeTeamPerformance(db: SupabaseClient, today = istDateStr()): Promise<TeamPerf> {
  const { start: mStart, end: mEnd } = monthBounds(today);
  const months6 = lastMonthKeys(today, 6);

  const [{ data: recruiters }, { data: statuses }, { data: subs }, { data: history }, { data: allocs }, { data: vals }, { data: goalsRaw }, { data: wRow }] =
    await Promise.all([
      db.from("profiles").select("id, full_name, monthly_submission_target, monthly_closure_target").eq("role", "recruiter").eq("is_active", true),
      db.from("submission_statuses").select("id, code, label, counts_as_closure, sort_order"),
      db.from("submissions").select("id, recruiter_id, requirement_id, current_status_id, submitted_date, last_status_at"),
      db.from("submission_status_history").select("submission_id, new_status_id, changed_at"),
      db.from("allocations").select("recruiter_id, requirement_id, allocation_date"),
      db.from("daily_activity_values").select("recruiter_id, activity_date, value, daily_metrics(key)"),
      db.from("recruiter_goals").select("recruiter_id, period_month, submission_target, closure_target"),
      db.from("app_settings").select("value").eq("key", "leaderboard_weights").maybeSingle(),
    ]);

  const weights = { submissions: 1, closures: 5, active_days: 2, ...((wRow?.value as any) ?? {}) };
  const stById = new Map((statuses ?? []).map((s: any) => [s.id, s]));
  const sortByCode = (code: string) => (statuses ?? []).find((s: any) => s.code === code)?.sort_order ?? Infinity;
  const clientSort = sortByCode("client_submitted");
  const interviewSort = sortByCode("tech_interview");
  const closureSort = Math.min(...((statuses ?? []).filter((s: any) => s.counts_as_closure).map((s: any) => s.sort_order)), Infinity);
  const closureSet = new Set((statuses ?? []).filter((s: any) => s.counts_as_closure).map((s: any) => s.id));

  // index history: max sort attained per submission, and closure timestamp
  const maxSortBySub = new Map<string, number>();
  for (const s of (subs ?? []) as any[]) maxSortBySub.set(s.id, stById.get(s.current_status_id)?.sort_order ?? 0);
  const closureAtBySub = new Map<string, string>();
  for (const h of (history ?? []) as any[]) {
    const so = stById.get(h.new_status_id)?.sort_order ?? 0;
    maxSortBySub.set(h.submission_id, Math.max(maxSortBySub.get(h.submission_id) ?? 0, so));
    if (closureSet.has(h.new_status_id) && !closureAtBySub.has(h.submission_id)) closureAtBySub.set(h.submission_id, h.changed_at);
  }

  // goals per recruiter -> month map
  const goalsByRec = new Map<string, Map<string, { sub: number | null; cl: number | null }>>();
  for (const g of (goalsRaw ?? []) as any[]) {
    if (!goalsByRec.has(g.recruiter_id)) goalsByRec.set(g.recruiter_id, new Map());
    goalsByRec.get(g.recruiter_id)!.set(g.period_month, { sub: g.submission_target, cl: g.closure_target });
  }

  // sourced + active dates per recruiter
  const sourcedMonth = new Map<string, number>();
  const activeDates = new Map<string, Set<string>>();
  for (const v of (vals ?? []) as any[]) {
    if (!activeDates.has(v.recruiter_id)) activeDates.set(v.recruiter_id, new Set());
    if ((v.value ?? 0) > 0) activeDates.get(v.recruiter_id)!.add(v.activity_date);
    if (v.daily_metrics?.key === "profiles_sourced" && inRange(v.activity_date, mStart, mEnd)) {
      sourcedMonth.set(v.recruiter_id, (sourcedMonth.get(v.recruiter_id) ?? 0) + (v.value ?? 0));
    }
  }

  const daysInMonth = new Date(asISO(mEnd)).getUTCDate();
  const dayOfMonth = new Date(asISO(today)).getUTCDate();
  const frac = Math.min(1, dayOfMonth / daysInMonth);
  const daysLeft = Math.max(0, daysInMonth - dayOfMonth);

  // first-submission days (team-level allocation -> first sub for that recruiter+req)
  const firstSubByRec = new Map<string, number[]>();
  const subsByRecReq = new Map<string, string>(); // key recruiter|req -> earliest submitted_date
  for (const s of (subs ?? []) as any[]) {
    const k = `${s.recruiter_id}|${s.requirement_id}`;
    const cur = subsByRecReq.get(k);
    if (!cur || s.submitted_date < cur) subsByRecReq.set(k, s.submitted_date);
  }
  for (const a of (allocs ?? []) as any[]) {
    const first = subsByRecReq.get(`${a.recruiter_id}|${a.requirement_id}`);
    if (first && first >= a.allocation_date) {
      const d = daysBetween(a.allocation_date, first);
      if (!firstSubByRec.has(a.recruiter_id)) firstSubByRec.set(a.recruiter_id, []);
      firstSubByRec.get(a.recruiter_id)!.push(d);
    }
  }

  const rows: PerfRow[] = (recruiters ?? []).map((r: any) => {
    const fb = { sub: r.monthly_submission_target ?? null, cl: r.monthly_closure_target ?? null };
    const goals = goalsByRec.get(r.id) ?? new Map();
    const mySubs = (subs ?? []).filter((s: any) => s.recruiter_id === r.id);

    // current-month actuals
    const subActual = mySubs.filter((s: any) => inRange(s.submitted_date, mStart, mEnd)).length;
    const clActual = mySubs.filter((s: any) => closureSet.has(s.current_status_id) && inRange(s.last_status_at, mStart, mEnd)).length;
    const t = targetFor(goals, monthKey(today), fb);
    const pacing: Pacing = {
      subTarget: t.sub, subActual, subProjected: projected(subActual, frac), subPace: paceOf(subActual, t.sub, frac),
      clTarget: t.cl, clActual, clProjected: projected(clActual, frac), clPace: paceOf(clActual, t.cl, frac),
      fractionElapsed: frac, daysLeft,
    };

    // scorecard (6 months)
    const scorecard: MonthCell[] = months6.map((mk) => {
      const tt = targetFor(goals, mk, fb);
      const subA = mySubs.filter((s: any) => monthKey(s.submitted_date) === mk).length;
      const clA = mySubs.filter((s: any) => closureSet.has(s.current_status_id) && s.last_status_at && monthKey(s.last_status_at) === mk).length;
      return {
        month: mk, subTarget: tt.sub, subActual: subA, subPct: tt.sub ? Math.round((subA / tt.sub) * 100) : null,
        clTarget: tt.cl, clActual: clA, clPct: tt.cl ? Math.round((clA / tt.cl) * 100) : null,
      };
    });

    // time-to KPIs
    const ttfsArr = firstSubByRec.get(r.id) ?? [];
    const timeToFirstSub = ttfsArr.length ? round1(avg(ttfsArr)) : null;
    const closureDurations: number[] = [];
    for (const s of mySubs as any[]) {
      const at = closureAtBySub.get(s.id) ?? (closureSet.has(s.current_status_id) ? s.last_status_at : null);
      if (at) { const d = daysBetween(s.submitted_date, at.slice(0, 10)); if (d >= 0) closureDurations.push(d); }
    }
    const timeToClosure = closureDurations.length ? round1(avg(closureDurations)) : null;

    // conversion funnel (this month's submissions)
    const monthSubs = mySubs.filter((s: any) => inRange(s.submitted_date, mStart, mEnd));
    const denom = monthSubs.length || 1;
    let rc = 0, ri = 0, rcl = 0;
    for (const s of monthSubs as any[]) {
      const ms = maxSortBySub.get(s.id) ?? 0;
      if (ms >= clientSort) rc++;
      if (ms >= interviewSort) ri++;
      if (ms >= closureSort) rcl++;
    }
    const pct = (x: number) => Math.round((x / denom) * 100);

    // efficiency
    const sourced = sourcedMonth.get(r.id) ?? 0;
    const subsPer100 = sourced > 0 ? round1((subActual / sourced) * 100) : null;
    const closuresPer100 = sourced > 0 ? round1((clActual / sourced) * 100) : null;

    // streak + active days
    const dates = activeDates.get(r.id) ?? new Set<string>();
    const activeDays = [...dates].filter((d) => inRange(d, mStart, mEnd)).length;
    let streak = 0, cursor = today;
    while (dates.has(cursor)) { streak++; cursor = addDays(cursor, -1); }

    const score = Math.round(subActual * weights.submissions + clActual * weights.closures + activeDays * weights.active_days);

    return {
      id: r.id, name: r.full_name, pacing, scorecard, timeToFirstSub, timeToClosure,
      convClientPct: pct(rc), convInterviewPct: pct(ri), convClosurePct: pct(rcl),
      sourced, subsPer100, closuresPer100, activeDays, streak, score, rank: 0,
      subVsMedian: "even", clVsMedian: "even",
    };
  });

  // benchmarking + ranking
  const subMedian = median(rows.map((r) => r.pacing.subActual));
  const clMedian = median(rows.map((r) => r.pacing.clActual));
  for (const r of rows) {
    r.subVsMedian = r.pacing.subActual > subMedian ? "above" : r.pacing.subActual < subMedian ? "below" : "even";
    r.clVsMedian = r.pacing.clActual > clMedian ? "above" : r.pacing.clActual < clMedian ? "below" : "even";
  }
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => (r.rank = i + 1));

  // team stage dwell times (avg days a candidate sits in each stage)
  const eventsBySub = new Map<string, { at: string; sort: number; label: string }[]>();
  for (const s of (subs ?? []) as any[]) {
    eventsBySub.set(s.id, [{ at: s.submitted_date + "T00:00:00Z", sort: 0, label: "__start" }]);
  }
  for (const h of (history ?? []) as any[]) {
    const st = stById.get(h.new_status_id);
    const arr = eventsBySub.get(h.submission_id); if (!arr || !st) continue;
    arr.push({ at: h.changed_at, sort: st.sort_order, label: st.label });
  }
  const dwellAgg = new Map<string, { total: number; n: number }>();
  for (const arr of eventsBySub.values()) {
    arr.sort((a, b) => a.at.localeCompare(b.at));
    for (let i = 0; i < arr.length - 1; i++) {
      const from = arr[i], to = arr[i + 1];
      if (from.label === "__start") continue; // first leg has no stage label
      const d = daysBetween(from.at.slice(0, 10), to.at.slice(0, 10));
      if (d < 0) continue;
      const cur = dwellAgg.get(from.label) ?? { total: 0, n: 0 };
      cur.total += d; cur.n += 1; dwellAgg.set(from.label, cur);
    }
  }
  const stageDwell: StageDwell[] = [...dwellAgg.entries()]
    .map(([stage, v]) => ({ stage, avgDays: round1(v.total / v.n), n: v.n }))
    .sort((a, b) => b.avgDays - a.avgDays);

  // team conversion trend (last 6 months)
  const convTrend: ConvPoint[] = months6.map((mk) => {
    const monthSubs = (subs ?? []).filter((s: any) => monthKey(s.submitted_date) === mk);
    const denom = monthSubs.length || 1;
    let rc = 0, ri = 0, rcl = 0;
    for (const s of monthSubs as any[]) {
      const ms = maxSortBySub.get(s.id) ?? 0;
      if (ms >= clientSort) rc++; if (ms >= interviewSort) ri++; if (ms >= closureSort) rcl++;
    }
    return { month: mk, submitted: monthSubs.length, clientPct: Math.round((rc / denom) * 100), interviewPct: Math.round((ri / denom) * 100), closurePct: Math.round((rcl / denom) * 100) };
  });

  return { recruiters: rows, subMedian, clMedian, stageDwell, convTrend, weights };
}

// =============================================================
// One recruiter's pacing + streak + scorecard (their own dashboard).
// =============================================================
export async function computeRecruiterPacing(db: SupabaseClient, recruiterId: string, today = istDateStr()) {
  const { start: mStart, end: mEnd } = monthBounds(today);
  const months6 = lastMonthKeys(today, 6);

  const [{ data: prof }, { data: statuses }, { data: subs }, { data: vals }, { data: goalsRaw }] = await Promise.all([
    db.from("profiles").select("monthly_submission_target, monthly_closure_target").eq("id", recruiterId).maybeSingle(),
    db.from("submission_statuses").select("id, counts_as_closure"),
    db.from("submissions").select("current_status_id, submitted_date, last_status_at").eq("recruiter_id", recruiterId),
    db.from("daily_activity_values").select("activity_date, value").eq("recruiter_id", recruiterId),
    db.from("recruiter_goals").select("period_month, submission_target, closure_target").eq("recruiter_id", recruiterId),
  ]);

  const closureSet = new Set((statuses ?? []).filter((s: any) => s.counts_as_closure).map((s: any) => s.id));
  const fb = { sub: prof?.monthly_submission_target ?? null, cl: prof?.monthly_closure_target ?? null };
  const goals = new Map<string, { sub: number | null; cl: number | null }>();
  for (const g of (goalsRaw ?? []) as any[]) goals.set(g.period_month, { sub: g.submission_target, cl: g.closure_target });

  const subActual = (subs ?? []).filter((s: any) => inRange(s.submitted_date, mStart, mEnd)).length;
  const clActual = (subs ?? []).filter((s: any) => closureSet.has(s.current_status_id) && inRange(s.last_status_at, mStart, mEnd)).length;

  const daysInMonth = new Date(asISO(mEnd)).getUTCDate();
  const dayOfMonth = new Date(asISO(today)).getUTCDate();
  const frac = Math.min(1, dayOfMonth / daysInMonth);
  const t = targetFor(goals, monthKey(today), fb);

  const pacing: Pacing = {
    subTarget: t.sub, subActual, subProjected: projected(subActual, frac), subPace: paceOf(subActual, t.sub, frac),
    clTarget: t.cl, clActual, clProjected: projected(clActual, frac), clPace: paceOf(clActual, t.cl, frac),
    fractionElapsed: frac, daysLeft: Math.max(0, daysInMonth - dayOfMonth),
  };

  const dates = new Set((vals ?? []).filter((v: any) => (v.value ?? 0) > 0).map((v: any) => v.activity_date));
  const activeDays = [...dates].filter((d) => inRange(d as string, mStart, mEnd)).length;
  let streak = 0, cursor = today;
  while (dates.has(cursor)) { streak++; cursor = addDays(cursor, -1); }

  const scorecard: MonthCell[] = months6.map((mk) => {
    const tt = targetFor(goals, mk, fb);
    const subA = (subs ?? []).filter((s: any) => monthKey(s.submitted_date) === mk).length;
    const clA = (subs ?? []).filter((s: any) => closureSet.has(s.current_status_id) && s.last_status_at && monthKey(s.last_status_at) === mk).length;
    return { month: mk, subTarget: tt.sub, subActual: subA, subPct: tt.sub ? Math.round((subA / tt.sub) * 100) : null, clTarget: tt.cl, clActual: clA, clPct: tt.cl ? Math.round((clA / tt.cl) * 100) : null };
  });

  return { pacing, activeDays, streak, scorecard };
}

// ---------- tiny math/date utils ----------
function asISO(d: string) { return d + "T00:00:00Z"; }
function daysBetween(a: string, b: string) { return Math.round((Date.parse(asISO(b)) - Date.parse(asISO(a))) / 86400000); }
function avg(xs: number[]) { return xs.reduce((n, x) => n + x, 0) / xs.length; }
function round1(x: number) { return Math.round(x * 10) / 10; }
