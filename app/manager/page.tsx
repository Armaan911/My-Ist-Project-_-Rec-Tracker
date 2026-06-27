import { createAdminClient } from "@/lib/supabase/admin";
import { istDateStr, monthBounds, weekBuckets, inRange, addDays } from "@/lib/dates";
import { medalFor } from "@/lib/medals";
import ManagerDashboard from "@/components/ManagerDashboard";
import { computeTeamPerformance } from "@/lib/performance";

export const dynamic = "force-dynamic";

const HAPPY = ["internal_submitted", "client_submitted", "tech_interview", "closure", "onboarded"];

export default async function ManagerPage() {
  // Managers oversee every division — read via service-role (page is role-gated by the manager layout).
  const supabase = createAdminClient();
  const today = istDateStr();
  const { start: mStart, end: mEnd } = monthBounds(today);
  const { start: pmStart, end: pmEnd } = monthBounds(addDays(mStart, -1)); // previous month
  const yr = today.slice(0, 4);
  const yStart = `${yr}-01-01`, yEnd = `${yr}-12-31`;                          // current year
  const pyStart = `${Number(yr) - 1}-01-01`, pyEnd = `${Number(yr) - 1}-12-31`; // previous year
  // short windows for the recruiter-performance filter (today / yesterday / this week / last week)
  const wks = weekBuckets(today, 2);
  const tw = wks[wks.length - 1] ?? { start: today, end: today };  // this week (Mon–Sun)
  const lw = wks[wks.length - 2] ?? { start: today, end: today };  // last week
  const yday = addDays(today, -1);

  const [
    { data: divisions }, { data: recruiters }, { data: statuses }, { data: subs },
    { data: requirements }, { data: alerts }, { data: tiers }, { data: snaps }, { data: history },
    { data: clients }, { data: metricDefs }, { data: effort }, { data: goalsRows }, { data: memberRows },
  ] = await Promise.all([
    supabase.from("divisions").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, division_id, monthly_submission_target, monthly_closure_target, is_active").eq("role", "recruiter"),
    supabase.from("submission_statuses").select("id, code, label, counts_as_closure, sort_order, is_active").eq("is_active", true).order("sort_order"),
    supabase.from("submissions").select("id, recruiter_id, division_id, current_status_id, submitted_date, last_status_at, candidate_email, candidate_name, verified_at, requirements(title, job_code)"),
    supabase.from("requirements").select("id, division_id, status, title, job_code, priority, date_received, clients(name)"),
    supabase.from("alerts").select("id, type, severity, title, body, is_read, created_at, division_id").order("is_read").order("created_at", { ascending: false }).limit(50),
    supabase.from("medal_tiers").select("name, min_closures, color, rank"),
    supabase.from("performance_snapshots").select("period_type, closures, period_end, is_winner, division_id, profiles(full_name)").eq("is_winner", true).order("period_end", { ascending: false }),
    supabase.from("submission_status_history").select("submission_id, new_status_id"),
    supabase.from("clients").select("id, name, division_id"),
    supabase.from("daily_metrics").select("id, key, label, color, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("daily_activity_values").select("division_id, metric_id, value").gte("activity_date", mStart).lte("activity_date", mEnd),
    supabase.from("recruiter_goals").select("recruiter_id, submission_target, closure_target").eq("period_month", today.slice(0, 7)),
    supabase.from("profile_divisions").select("profile_id, division_id"),
  ]);

  // Per-month goals set by managers/admins override the profile's default target.
  const goalByRec = new Map<string, { sub: number | null; cl: number | null }>();
  for (const g of (goalsRows ?? []) as any[]) goalByRec.set(g.recruiter_id, { sub: g.submission_target, cl: g.closure_target });

  // A recruiter can serve several divisions (profile_divisions), not just their primary one.
  // Build full membership so division tabs/pickers show everyone who works that division.
  const divsByRec = new Map<string, Set<string>>();
  for (const r of (recruiters ?? []) as any[]) { const s = new Set<string>(); if (r.division_id) s.add(r.division_id); divsByRec.set(r.id, s); }
  for (const m of (memberRows ?? []) as any[]) { if (!divsByRec.has(m.profile_id)) divsByRec.set(m.profile_id, new Set()); divsByRec.get(m.profile_id)!.add(m.division_id); }
  const servesDivision = (recId: string, divId: string | null) => !divId || (divsByRec.get(recId)?.has(divId) ?? false);

  const statusMap = new Map((statuses ?? []).map((s: any) => [s.id, s]));
  const codeOf = (id: string) => statusMap.get(id)?.code as string | undefined;
  const labelOf = (id: string) => statusMap.get(id)?.label ?? "—";
  const isClosure = (id: string) => !!statusMap.get(id)?.counts_as_closure;
  const buckets = weekBuckets(today, 8);
  const nameOf = new Map((recruiters ?? []).map((r: any) => [r.id, r.full_name]));

  // submission -> set of happy-path stage codes it ever reached (from history)
  const reached = new Map<string, Set<string>>();
  for (const h of (history ?? []) as any[]) {
    const code = codeOf(h.new_status_id);
    if (!code || !HAPPY.includes(code)) continue;
    if (!reached.has(h.submission_id)) reached.set(h.submission_id, new Set());
    reached.get(h.submission_id)!.add(code);
  }
  const reachedAtLeast = (subId: string, stage: string) => {
    const set = reached.get(subId);
    if (!set) return false;
    const idx = HAPPY.indexOf(stage);
    return HAPPY.slice(idx).some((c) => set.has(c));
  };

  function buildData(divId: string | null, verifiedOnly: boolean) {
    const recs = (recruiters ?? []).filter((r: any) => r.is_active && servesDivision(r.id, divId));
    // "Verified only" keeps just coordinator-verified submissions (drives every submission-based metric below).
    const divSubs = (subs ?? []).filter((s: any) => (divId ? s.division_id === divId : true) && (verifiedOnly ? !!s.verified_at : true));
    const divReqs = (requirements ?? []).filter((r: any) => (divId ? r.division_id === divId : true));
    const openReqs = divReqs.filter((r: any) => r.status === "open").length;

    const byId: Record<string, any> = {};
    for (const r of recs) byId[r.id] = {
      id: r.id, name: r.full_name,
      target: goalByRec.get(r.id)?.sub ?? r.monthly_submission_target,
      closureTarget: goalByRec.get(r.id)?.cl ?? r.monthly_closure_target,
      closuresAll: 0, closuresMonth: 0, submissionsMonth: 0, submissionsPrev: 0, closuresPrev: 0,
      closuresYear: 0, submissionsYear: 0, closuresPrevYear: 0, submissionsPrevYear: 0,
      subsToday: 0, closToday: 0, subsYday: 0, closYday: 0, subsWeek: 0, closWeek: 0, subsLastWeek: 0, closLastWeek: 0,
      total: 0, reachedClient: 0, reachedInterview: 0, reachedClosure: 0,
      monthSubs: 0, monthWithEmail: 0, statusDist: {} as Record<string, number>,
    };
    for (const s of divSubs as any[]) {
      const row = byId[s.recruiter_id]; if (!row) continue;
      row.total++;
      row.statusDist[labelOf(s.current_status_id)] = (row.statusDist[labelOf(s.current_status_id)] ?? 0) + 1;
      if (reachedAtLeast(s.id, "client_submitted")) row.reachedClient++;
      if (reachedAtLeast(s.id, "tech_interview")) row.reachedInterview++;
      if (reachedAtLeast(s.id, "closure")) row.reachedClosure++;
      if (isClosure(s.current_status_id)) {
        row.closuresAll++;
        if (inRange(s.last_status_at, mStart, mEnd)) row.closuresMonth++;
        if (inRange(s.last_status_at, pmStart, pmEnd)) row.closuresPrev++;
        if (inRange(s.last_status_at, yStart, yEnd)) row.closuresYear++;
        if (inRange(s.last_status_at, pyStart, pyEnd)) row.closuresPrevYear++;
        if (inRange(s.last_status_at, today, today)) row.closToday++;
        if (inRange(s.last_status_at, yday, yday)) row.closYday++;
        if (inRange(s.last_status_at, tw.start, tw.end)) row.closWeek++;
        if (inRange(s.last_status_at, lw.start, lw.end)) row.closLastWeek++;
      }
      if (inRange(s.submitted_date, mStart, mEnd)) { row.submissionsMonth++; row.monthSubs++; if (s.candidate_email) row.monthWithEmail++; }
      if (inRange(s.submitted_date, pmStart, pmEnd)) row.submissionsPrev++;
      if (inRange(s.submitted_date, yStart, yEnd)) row.submissionsYear++;
      if (inRange(s.submitted_date, pyStart, pyEnd)) row.submissionsPrevYear++;
      if (inRange(s.submitted_date, today, today)) row.subsToday++;
      if (inRange(s.submitted_date, yday, yday)) row.subsYday++;
      if (inRange(s.submitted_date, tw.start, tw.end)) row.subsWeek++;
      if (inRange(s.submitted_date, lw.start, lw.end)) row.subsLastWeek++;
    }
    const rows = Object.values(byId) as any[];

    let bestName = "", worstName = "";
    if (rows.length >= 2) {
      const sorted = [...rows].sort((a, b) => b.closuresMonth - a.closuresMonth || b.submissionsMonth - a.submissionsMonth);
      bestName = sorted[0].name; worstName = sorted[sorted.length - 1].name;
    }

    const counts = new Map<string, number>();
    for (const s of divSubs as any[]) counts.set(s.current_status_id, (counts.get(s.current_status_id) ?? 0) + 1);
    const funnel = (statuses ?? []).map((st: any) => ({ stage: st.label, count: counts.get(st.id) ?? 0 }));

    const byRecruiter = rows.map((r: any) => ({ name: r.name, closures: r.closuresMonth, isBest: r.name === bestName, isWorst: r.name === worstName }));

    const trend = buckets.map((b) => {
      let submissions = 0, closures = 0;
      for (const s of divSubs as any[]) {
        if (inRange(s.submitted_date, b.start, b.end)) submissions++;
        if (isClosure(s.current_status_id) && inRange(s.last_status_at, b.start, b.end)) closures++;
      }
      return { week: b.label, submissions, closures };
    });

    const buildPodium = (clKey: string, subKey: string) => [...rows]
      .sort((a, b) => b[clKey] - a[clKey] || b[subKey] - a[subKey])
      .map((r: any) => ({ name: r.name, closures: r[clKey], submissions: r[subKey], closuresAll: r.closuresAll, target: r.target, medal: medalFor(r.closuresAll, tiers ?? []) }));
    const leaderboards = {
      month: buildPodium("closuresMonth", "submissionsMonth"),
      prevMonth: buildPodium("closuresPrev", "submissionsPrev"),
      year: buildPodium("closuresYear", "submissionsYear"),
      prevYear: buildPodium("closuresPrevYear", "submissionsPrevYear"),
    };

    // rich per-recruiter analytics for the performance panel
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
    const recruiterStats = rows.map((r: any) => ({
      id: r.id, name: r.name,
      submissionsMonth: r.submissionsMonth, closuresMonth: r.closuresMonth,
      submissionsPrev: r.submissionsPrev, closuresPrev: r.closuresPrev,
      subTarget: r.target ?? null, closureTarget: r.closureTarget ?? null,
      total: r.total,
      periods: {
        today: { subs: r.subsToday, closures: r.closToday },
        yesterday: { subs: r.subsYday, closures: r.closYday },
        thisWeek: { subs: r.subsWeek, closures: r.closWeek },
        lastWeek: { subs: r.subsLastWeek, closures: r.closLastWeek },
        thisMonth: { subs: r.submissionsMonth, closures: r.closuresMonth },
      },
      conv: {
        client: pct(r.reachedClient, r.total),
        interview: pct(r.reachedInterview, r.total),
        closure: pct(r.reachedClosure, r.total),
        counts: { submitted: r.total, client: r.reachedClient, interview: r.reachedInterview, closure: r.reachedClosure },
      },
      qualityPct: pct(r.monthWithEmail, r.monthSubs),
      statusDist: Object.entries(r.statusDist).map(([name, value]) => ({ name, value: value as number })),
    }));

    const overallPie = funnel.filter((f) => f.count > 0).map((f) => ({ name: f.stage, value: f.count }));

    const pick = (type: string) => {
      const w = (snaps ?? []).find((x: any) => x.period_type === type && (divId ? x.division_id === divId : true));
      return w ? { period_type: type, name: (w.profiles as any)?.full_name ?? "—", closures: w.closures, period_end: w.period_end } : null;
    };
    const divAlerts = (alerts ?? []).filter((a: any) => (divId ? a.division_id === divId : true));

    // ---- #2 drill-down detail lists (records behind each stat card) ----
    const openRequirements = divReqs
      .filter((r: any) => r.status === "open")
      .map((r: any) => ({ id: r.id, title: r.title, job_code: r.job_code ?? null, client: (r.clients as any)?.name ?? null, priority: r.priority ?? null, date_received: r.date_received }))
      .sort((a: any, b: any) => (b.date_received ?? "").localeCompare(a.date_received ?? ""));

    const submissionsList = divSubs
      .filter((s: any) => inRange(s.submitted_date, mStart, mEnd))
      .map((s: any) => ({ candidate: s.candidate_name ?? s.candidate_email ?? "—", recruiter: nameOf.get(s.recruiter_id) ?? "—", status: labelOf(s.current_status_id), requirement: (s.requirements as any)?.title ?? "—", date: s.submitted_date }))
      .sort((a: any, b: any) => (b.date ?? "").localeCompare(a.date ?? ""));

    const closuresList = divSubs
      .filter((s: any) => isClosure(s.current_status_id) && inRange(s.last_status_at, mStart, mEnd))
      .map((s: any) => ({ candidate: s.candidate_name ?? s.candidate_email ?? "—", recruiter: nameOf.get(s.recruiter_id) ?? "—", requirement: (s.requirements as any)?.title ?? "—", date: (s.last_status_at ?? "").slice(0, 10) }))
      .sort((a: any, b: any) => (b.date ?? "").localeCompare(a.date ?? ""));

    const recruitersList = rows
      .map((r: any) => ({ name: r.name, submissionsMonth: r.submissionsMonth, closuresMonth: r.closuresMonth, openReqs: 0 }))
      .sort((a: any, b: any) => b.closuresMonth - a.closuresMonth || b.submissionsMonth - a.submissionsMonth);

    // ---- #3 detailed analytics ----
    // Pivot: recruiters x pipeline stage (current status counts)
    const stageLabels = (statuses ?? []).map((st: any) => st.label);
    const pivot = rows.map((r: any) => ({
      name: r.name,
      cells: stageLabels.map((lbl: string) => r.statusDist[lbl] ?? 0),
      total: r.total,
    }));

    // Team daily-effort (this month) per configured metric, from per-requirement values
    const divEffort = (effort ?? []).filter((e: any) => (divId ? e.division_id === divId : true));
    const sumByMetric = new Map<string, number>();
    for (const e of divEffort as any[]) sumByMetric.set(e.metric_id, (sumByMetric.get(e.metric_id) ?? 0) + (e.value ?? 0));
    const teamEffort = ((metricDefs ?? []) as any[]).map((m) => ({ label: m.label, color: m.color, value: sumByMetric.get(m.id) ?? 0 }));

    // Requirement status breakdown
    const reqStatusCounts: Record<string, number> = {};
    for (const r of divReqs as any[]) reqStatusCounts[r.status] = (reqStatusCounts[r.status] ?? 0) + 1;
    const reqStatusBreakdown = Object.entries(reqStatusCounts).map(([name, value]) => ({ name, value: value as number }));

    // Per-client requirement counts
    const clientCounts = new Map<string, number>();
    for (const r of divReqs as any[]) {
      const cn = (r.clients as any)?.name ?? "No client";
      clientCounts.set(cn, (clientCounts.get(cn) ?? 0) + 1);
    }
    const byClient = [...clientCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    return {
      stats: {
        openReqs,
        // Match the drill-down lists exactly so the card number == the popup count.
        subsMonth: submissionsList.length,
        closuresMonth: closuresList.length,
        activeRecruiters: recs.length,
      },
      funnel, byRecruiter, trend, leaderboards,
      recruiterStats, overallPie,
      alerts: divAlerts,
      performers: { week: pick("weekly"), month: pick("monthly"), year: pick("yearly") },
      details: { openRequirements, submissions: submissionsList, closures: closuresList, recruiters: recruitersList },
      analytics: { stageLabels, pivot, teamEffort, reqStatusBreakdown, byClient },
    };
  }

  const performance = await computeTeamPerformance(supabase, today);

  const buildPayload = (verifiedOnly: boolean) => ({
    divisions: (divisions ?? []).map((d: any) => ({ id: d.id, name: d.name })),
    overall: buildData(null, verifiedOnly),
    byDivision: Object.fromEntries((divisions ?? []).map((d: any) => [d.id, buildData(d.id, verifiedOnly)])),
    performance,
  });

  return <ManagerDashboard data={buildPayload(false)} verified={buildPayload(true)} today={today} />;
}
