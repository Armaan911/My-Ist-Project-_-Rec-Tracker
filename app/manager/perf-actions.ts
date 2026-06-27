"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { inRange } from "@/lib/dates";

// Per-recruiter submissions/closures for an arbitrary [from,to] window (manager/admin),
// optionally scoped to one division — powers the "Custom range" option on the perf table.
export async function recruiterRangeStats(fromDate: string, toDate: string, divisionId?: string | null) {
  const empty: Record<string, { subs: number; closures: number }> = {};
  const me = await getProfile();
  if (me?.role !== "manager" && me?.role !== "admin") return { ok: false as const, error: "Not authorized", data: empty };
  if (!fromDate || !toDate) return { ok: false as const, error: "Pick a from and to date", data: empty };
  const lo = fromDate <= toDate ? fromDate : toDate;
  const hi = fromDate <= toDate ? toDate : fromDate;

  const admin = createAdminClient();
  const [{ data: statuses }, { data: subs }] = await Promise.all([
    admin.from("submission_statuses").select("id, counts_as_closure"),
    admin.from("submissions").select("recruiter_id, division_id, current_status_id, submitted_date, last_status_at"),
  ]);
  const closureIds = new Set(((statuses ?? []) as any[]).filter((s) => s.counts_as_closure).map((s) => s.id));
  const data: Record<string, { subs: number; closures: number }> = {};
  for (const s of (subs ?? []) as any[]) {
    if (divisionId && s.division_id !== divisionId) continue;
    const rid = s.recruiter_id; if (!rid) continue;
    const o = data[rid] ?? { subs: 0, closures: 0 };
    if (inRange(s.submitted_date, lo, hi)) o.subs++;
    if (closureIds.has(s.current_status_id) && inRange(s.last_status_at, lo, hi)) o.closures++;
    data[rid] = o;
  }
  return { ok: true as const, data };
}

const HAPPY = ["internal_submitted", "client_submitted", "tech_interview", "closure", "onboarded"];

// Full per-recruiter stats for a window: subs, closures, conversion (reached stages),
// data quality (emails), and pipeline-by-stage — so every perf metric updates with the range.
export async function recruiterRangeFull(fromDate: string, toDate: string, divisionId?: string | null) {
  const empty: Record<string, any> = {};
  const me = await getProfile();
  if (me?.role !== "manager" && me?.role !== "admin") return { ok: false as const, error: "Not authorized", data: empty };
  if (!fromDate || !toDate) return { ok: false as const, error: "Pick a from and to date", data: empty };
  const lo = fromDate <= toDate ? fromDate : toDate;
  const hi = fromDate <= toDate ? toDate : fromDate;

  const admin = createAdminClient();
  const [{ data: statuses }, { data: subs }, { data: history }] = await Promise.all([
    admin.from("submission_statuses").select("id, label, code, counts_as_closure"),
    admin.from("submissions").select("id, recruiter_id, division_id, current_status_id, submitted_date, last_status_at, candidate_email"),
    admin.from("submission_status_history").select("submission_id, new_status_id"),
  ]);
  const closureIds = new Set(((statuses ?? []) as any[]).filter((s) => s.counts_as_closure).map((s) => s.id));
  const labelOf = new Map(((statuses ?? []) as any[]).map((s) => [s.id, s.label]));
  const codeOf = new Map(((statuses ?? []) as any[]).map((s) => [s.id, s.code]));

  const reached = new Map<string, Set<string>>();
  for (const h of (history ?? []) as any[]) {
    const code = codeOf.get(h.new_status_id);
    if (!code || !HAPPY.includes(code)) continue;
    if (!reached.has(h.submission_id)) reached.set(h.submission_id, new Set());
    reached.get(h.submission_id)!.add(code);
  }
  const reachedAtLeast = (subId: string, stage: string) => {
    const set = reached.get(subId); if (!set) return false;
    const idx = HAPPY.indexOf(stage); return HAPPY.slice(idx).some((c) => set.has(c));
  };

  const data: Record<string, any> = {};
  for (const s of (subs ?? []) as any[]) {
    if (divisionId && s.division_id !== divisionId) continue;
    const rid = s.recruiter_id; if (!rid) continue;
    const o = data[rid] ?? { subs: 0, closures: 0, total: 0, reachedClient: 0, reachedInterview: 0, reachedClosure: 0, withEmail: 0, statusDist: {} as Record<string, number> };
    if (inRange(s.submitted_date, lo, hi)) {
      o.subs++; o.total++;
      if (s.candidate_email) o.withEmail++;
      if (reachedAtLeast(s.id, "client_submitted")) o.reachedClient++;
      if (reachedAtLeast(s.id, "tech_interview")) o.reachedInterview++;
      if (reachedAtLeast(s.id, "closure")) o.reachedClosure++;
      const lbl = labelOf.get(s.current_status_id) ?? "Other";
      o.statusDist[lbl] = (o.statusDist[lbl] ?? 0) + 1;
    }
    if (closureIds.has(s.current_status_id) && inRange(s.last_status_at, lo, hi)) o.closures++;
    data[rid] = o;
  }
  return { ok: true as const, data };
}

// Full date-range REPORT for the detailed view: team totals, per-recruiter breakdown,
// and the underlying submission + closure records for any [from,to] window
// (manager/admin), optionally scoped to one division.
export async function rangeReport(fromDate: string, toDate: string, divisionId?: string | null) {
  const me = await getProfile();
  if (me?.role !== "manager" && me?.role !== "admin")
    return { ok: false as const, error: "Not authorized" };
  if (!fromDate || !toDate) return { ok: false as const, error: "Pick a from and to date" };
  const lo = fromDate <= toDate ? fromDate : toDate;
  const hi = fromDate <= toDate ? toDate : fromDate;

  const admin = createAdminClient();
  const [{ data: statuses }, { data: subs }, { data: recruiters }] = await Promise.all([
    admin.from("submission_statuses").select("id, label, counts_as_closure"),
    admin.from("submissions").select("recruiter_id, division_id, current_status_id, submitted_date, last_status_at, candidate_name, candidate_email, requirements(title)"),
    admin.from("profiles").select("id, full_name").eq("role", "recruiter"),
  ]);

  const closureIds = new Set(((statuses ?? []) as any[]).filter((s) => s.counts_as_closure).map((s) => s.id));
  const labelOf = new Map(((statuses ?? []) as any[]).map((s) => [s.id, s.label]));
  const nameOf = new Map(((recruiters ?? []) as any[]).map((r) => [r.id, r.full_name]));

  const per = new Map<string, { name: string; subs: number; closures: number }>();
  const bump = (rid: string, key: "subs" | "closures") => {
    const name = nameOf.get(rid) ?? "—";
    const o = per.get(rid) ?? { name, subs: 0, closures: 0 };
    o[key]++; per.set(rid, o);
  };

  const submissions: any[] = [];
  const closures: any[] = [];
  for (const s of (subs ?? []) as any[]) {
    if (divisionId && s.division_id !== divisionId) continue;
    const reqTitle = (s.requirements as any)?.title ?? "—";
    const cand = s.candidate_name ?? s.candidate_email ?? "—";
    const rec = nameOf.get(s.recruiter_id) ?? "—";
    if (inRange(s.submitted_date, lo, hi)) {
      if (s.recruiter_id) bump(s.recruiter_id, "subs");
      submissions.push({ candidate: cand, recruiter: rec, requirement: reqTitle, status: labelOf.get(s.current_status_id) ?? "—", date: s.submitted_date });
    }
    if (closureIds.has(s.current_status_id) && inRange(s.last_status_at, lo, hi)) {
      if (s.recruiter_id) bump(s.recruiter_id, "closures");
      closures.push({ candidate: cand, recruiter: rec, requirement: reqTitle, date: (s.last_status_at ?? "").slice(0, 10) });
    }
  }

  submissions.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  closures.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const perRecruiter = [...per.values()].sort((a, b) => b.closures - a.closures || b.subs - a.subs);

  return {
    ok: true as const,
    range: { from: lo, to: hi },
    totals: { submissions: submissions.length, closures: closures.length, activeRecruiters: perRecruiter.filter((r) => r.subs || r.closures).length },
    perRecruiter,
    submissions,
    closures,
  };
}

// Detailed analytics for an arbitrary [from,to] window (manager/admin), optionally one
// division. Powers the date filter on the Detailed view's four sections:
//   - teamEffort: daily-update activity logged in the range
//   - pivot: candidates submitted in the range, by recruiter x current stage
//   - reqStatusBreakdown / byClient: requirements received in the range
export async function analyticsRange(fromDate: string, toDate: string, divisionId?: string | null) {
  const me = await getProfile();
  if (me?.role !== "manager" && me?.role !== "admin") return { ok: false as const, error: "Not authorized" };
  if (!fromDate || !toDate) return { ok: false as const, error: "Pick a from and to date" };
  const lo = fromDate <= toDate ? fromDate : toDate;
  const hi = fromDate <= toDate ? toDate : fromDate;
  const admin = createAdminClient();

  const [{ data: statuses }, { data: recruiters }, { data: subs }, { data: requirements }, { data: metricDefs }, { data: effort }] =
    await Promise.all([
      admin.from("submission_statuses").select("id, label, sort_order, is_active").eq("is_active", true).order("sort_order"),
      admin.from("profiles").select("id, full_name").eq("role", "recruiter"),
      admin.from("submissions").select("recruiter_id, division_id, current_status_id, submitted_date"),
      admin.from("requirements").select("division_id, status, date_received, clients(name)"),
      admin.from("daily_metrics").select("id, label, color, sort_order").eq("is_active", true).order("sort_order"),
      admin.from("daily_activity_values").select("division_id, metric_id, value, activity_date"),
    ]);

  const labelOf = new Map(((statuses ?? []) as any[]).map((s) => [s.id, s.label]));
  const stageLabels = ((statuses ?? []) as any[]).map((s) => s.label);
  const nameOf = new Map(((recruiters ?? []) as any[]).map((r) => [r.id, r.full_name]));

  // who-at-stage pivot: candidates submitted in range, by recruiter x current stage
  const byRec = new Map<string, { name: string; counts: Record<string, number>; total: number }>();
  for (const s of (subs ?? []) as any[]) {
    if (divisionId && s.division_id !== divisionId) continue;
    if (!inRange(s.submitted_date, lo, hi)) continue;
    const name = nameOf.get(s.recruiter_id);
    if (!name) continue;
    const o = byRec.get(s.recruiter_id) ?? { name, counts: {} as Record<string, number>, total: 0 };
    const lbl = labelOf.get(s.current_status_id) ?? "Other";
    o.counts[lbl] = (o.counts[lbl] ?? 0) + 1;
    o.total++;
    byRec.set(s.recruiter_id, o);
  }
  const pivot = [...byRec.values()]
    .sort((a, b) => b.total - a.total)
    .map((r) => ({ name: r.name, cells: stageLabels.map((l) => r.counts[l] ?? 0), total: r.total }));

  // requirements received in range -> by status and by client
  const divReqs = (requirements ?? []).filter((r: any) => (divisionId ? r.division_id === divisionId : true) && inRange(r.date_received, lo, hi));
  const reqStatusCounts: Record<string, number> = {};
  const clientCounts = new Map<string, number>();
  for (const r of divReqs as any[]) {
    reqStatusCounts[r.status] = (reqStatusCounts[r.status] ?? 0) + 1;
    const cn = (r.clients as any)?.name ?? "No client";
    clientCounts.set(cn, (clientCounts.get(cn) ?? 0) + 1);
  }
  const reqStatusBreakdown = Object.entries(reqStatusCounts).map(([name, value]) => ({ name, value: value as number }));
  const byClient = [...clientCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // team daily-effort in range, per configured metric
  const sumByMetric = new Map<string, number>();
  for (const e of (effort ?? []) as any[]) {
    if (divisionId && e.division_id !== divisionId) continue;
    if (!inRange(e.activity_date, lo, hi)) continue;
    sumByMetric.set(e.metric_id, (sumByMetric.get(e.metric_id) ?? 0) + (e.value ?? 0));
  }
  const teamEffort = ((metricDefs ?? []) as any[]).map((m) => ({ label: m.label, color: m.color, value: sumByMetric.get(m.id) ?? 0 }));

  return { ok: true as const, data: { stageLabels, pivot, teamEffort, reqStatusBreakdown, byClient } };
}

// Range version of the "Performance" table + "Speed" KPIs (team-wide, manager/admin).
// Actuals over [from,to] with no month-pacing/projection — the scorecard and conversion
// trend stay month-based and are not recomputed here.
type Vs = "above" | "below" | "even";
export async function perfRange(fromDate: string, toDate: string) {
  const me = await getProfile();
  if (me?.role !== "manager" && me?.role !== "admin") return { ok: false as const, error: "Not authorized" };
  if (!fromDate || !toDate) return { ok: false as const, error: "Pick a from and to date" };
  const lo = fromDate <= toDate ? fromDate : toDate;
  const hi = fromDate <= toDate ? toDate : fromDate;
  const admin = createAdminClient();

  const asISO = (d: string) => d + "T00:00:00Z";
  const daysBetween = (a: string, b: string) => Math.round((Date.parse(asISO(b)) - Date.parse(asISO(a))) / 86400000);
  const avg = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / xs.length;
  const round1 = (x: number) => Math.round(x * 10) / 10;
  const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  const [{ data: recruiters }, { data: statuses }, { data: subs }, { data: history }, { data: allocs }, { data: vals }, { data: wRow }] =
    await Promise.all([
      admin.from("profiles").select("id, full_name").eq("role", "recruiter").eq("is_active", true),
      admin.from("submission_statuses").select("id, label, counts_as_closure"),
      admin.from("submissions").select("id, recruiter_id, requirement_id, current_status_id, submitted_date, last_status_at"),
      admin.from("submission_status_history").select("submission_id, new_status_id, changed_at"),
      admin.from("allocations").select("recruiter_id, requirement_id, allocation_date"),
      admin.from("daily_activity_values").select("recruiter_id, activity_date, value, daily_metrics(key)"),
      admin.from("app_settings").select("value").eq("key", "leaderboard_weights").maybeSingle(),
    ]);

  const weights = { submissions: 1, closures: 5, active_days: 2, ...((wRow?.value as any) ?? {}) };
  const stById = new Map(((statuses ?? []) as any[]).map((s) => [s.id, s]));
  const closureSet = new Set(((statuses ?? []) as any[]).filter((s) => s.counts_as_closure).map((s) => s.id));

  const closureAtBySub = new Map<string, string>();
  for (const h of (history ?? []) as any[]) {
    if (closureSet.has(h.new_status_id) && !closureAtBySub.has(h.submission_id)) closureAtBySub.set(h.submission_id, h.changed_at);
  }

  // active days + sourced (in range), per recruiter
  const sourcedRange = new Map<string, number>();
  const activeDates = new Map<string, Set<string>>();
  for (const v of (vals ?? []) as any[]) {
    if (!inRange(v.activity_date, lo, hi)) continue;
    if ((v.value ?? 0) > 0) {
      if (!activeDates.has(v.recruiter_id)) activeDates.set(v.recruiter_id, new Set());
      activeDates.get(v.recruiter_id)!.add(v.activity_date);
    }
    if ((v.daily_metrics as any)?.key === "profiles_sourced") sourcedRange.set(v.recruiter_id, (sourcedRange.get(v.recruiter_id) ?? 0) + (v.value ?? 0));
  }

  // time-to-first-submission: allocation -> earliest submission, for first-subs landing in range
  const earliestSub = new Map<string, string>();
  for (const s of (subs ?? []) as any[]) {
    const k = `${s.recruiter_id}|${s.requirement_id}`;
    const cur = earliestSub.get(k);
    if (!cur || s.submitted_date < cur) earliestSub.set(k, s.submitted_date);
  }
  const firstSubDays = new Map<string, number[]>();
  for (const a of (allocs ?? []) as any[]) {
    const first = earliestSub.get(`${a.recruiter_id}|${a.requirement_id}`);
    if (first && first >= a.allocation_date && inRange(first, lo, hi)) {
      if (!firstSubDays.has(a.recruiter_id)) firstSubDays.set(a.recruiter_id, []);
      firstSubDays.get(a.recruiter_id)!.push(daysBetween(a.allocation_date, first));
    }
  }

  const rows = ((recruiters ?? []) as any[]).map((r) => {
    const mySubs = (subs ?? []).filter((s: any) => s.recruiter_id === r.id);
    const subsN = mySubs.filter((s: any) => inRange(s.submitted_date, lo, hi)).length;
    const closuresN = mySubs.filter((s: any) => closureSet.has(s.current_status_id) && inRange(s.last_status_at, lo, hi)).length;
    const activeDays = activeDates.get(r.id)?.size ?? 0;
    const sourced = sourcedRange.get(r.id) ?? 0;
    const ttfs = firstSubDays.get(r.id) ?? [];
    const closureDur: number[] = [];
    for (const s of mySubs as any[]) {
      const at = closureAtBySub.get(s.id) ?? (closureSet.has(s.current_status_id) ? s.last_status_at : null);
      if (at && inRange(at.slice(0, 10), lo, hi)) { const d = daysBetween(s.submitted_date, at.slice(0, 10)); if (d >= 0) closureDur.push(d); }
    }
    return {
      id: r.id, name: r.full_name, subs: subsN, closures: closuresN, activeDays,
      subsPer100: sourced > 0 ? round1((subsN / sourced) * 100) : null,
      closuresPer100: sourced > 0 ? round1((closuresN / sourced) * 100) : null,
      score: Math.round(subsN * weights.submissions + closuresN * weights.closures + activeDays * weights.active_days),
      rank: 0, subVsMedian: "even" as Vs, clVsMedian: "even" as Vs,
      timeToFirstSub: ttfs.length ? round1(avg(ttfs)) : null,
      timeToClosure: closureDur.length ? round1(avg(closureDur)) : null,
    };
  });

  const subMedian = median(rows.map((r) => r.subs));
  const clMedian = median(rows.map((r) => r.closures));
  for (const r of rows) {
    r.subVsMedian = r.subs > subMedian ? "above" : r.subs < subMedian ? "below" : "even";
    r.clVsMedian = r.closures > clMedian ? "above" : r.closures < clMedian ? "below" : "even";
  }
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => (r.rank = i + 1));

  // stage dwell over the range (transitions whose start event falls in range)
  const eventsBySub = new Map<string, { at: string; label: string }[]>();
  for (const s of (subs ?? []) as any[]) eventsBySub.set(s.id, [{ at: s.submitted_date + "T00:00:00Z", label: "__start" }]);
  for (const h of (history ?? []) as any[]) {
    const st = stById.get(h.new_status_id);
    const arr = eventsBySub.get(h.submission_id);
    if (!arr || !st) continue;
    arr.push({ at: h.changed_at, label: (st as any).label });
  }
  const dwellAgg = new Map<string, { total: number; n: number }>();
  for (const arr of eventsBySub.values()) {
    arr.sort((a, b) => a.at.localeCompare(b.at));
    for (let i = 0; i < arr.length - 1; i++) {
      const fromE = arr[i], toE = arr[i + 1];
      if (fromE.label === "__start" || !inRange(fromE.at.slice(0, 10), lo, hi)) continue;
      const d = daysBetween(fromE.at.slice(0, 10), toE.at.slice(0, 10));
      if (d < 0) continue;
      const cur = dwellAgg.get(fromE.label) ?? { total: 0, n: 0 };
      cur.total += d; cur.n += 1; dwellAgg.set(fromE.label, cur);
    }
  }
  const stageDwell = [...dwellAgg.entries()].map(([stage, v]) => ({ stage, avgDays: round1(v.total / v.n), n: v.n })).sort((a, b) => b.avgDays - a.avgDays);

  return { ok: true as const, data: { recruiters: rows, subMedian, clMedian, stageDwell, weights } };
}
