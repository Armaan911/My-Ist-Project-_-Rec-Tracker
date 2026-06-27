import { createAdminClient } from "@/lib/supabase/admin";
import { istDateStr, addDays, inRange, monthBounds } from "@/lib/dates";
import { notifyBadges } from "@/lib/notify";

export type Badge = {
  id: string; code: string; name: string; description: string | null; icon: string | null;
  color: string | null; rule: string; threshold: number | null; period: string;
  is_repeatable: boolean; is_active: boolean; sort_order: number;
};

export type RecruiterMetrics = {
  submissionsTotal: number;
  submissionsWeek: number;
  submissionsMonth: number;
  closuresTotal: number;
  closuresMonth: number;
  clientSubmissionsTotal: number; // all-time sum of the 'client_submissions' daily metric
  distinctStatuses: number;
  activityDaysWeek: number;
  qualityPctMonth: number;      // % of this month's submissions with a candidate email
  submissionsMonthCount: number; // denominator for quality
};

// ---- period-key helpers ----
const monthKey = (d: string) => d.slice(0, 7);          // YYYY-MM
const yearKey = (d: string) => d.slice(0, 4);           // YYYY
export function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;                  // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - day + 3);               // Thursday of this ISO week
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weekBounds(today: string) {
  const dow = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7;
  const start = addDays(today, -dow);
  return { start, end: addDays(start, 6) };
}

// ---- metrics ----
export async function computeRecruiterMetrics(admin: ReturnType<typeof createAdminClient>, recruiterId: string, today = istDateStr()): Promise<RecruiterMetrics> {
  const { start: wStart, end: wEnd } = weekBounds(today);
  const { start: mStart, end: mEnd } = monthBounds(today);

  const [{ data: statuses }, { data: subs }, { data: hist }, { data: activity }, { data: clientSubRows }] = await Promise.all([
    admin.from("submission_statuses").select("id, counts_as_closure"),
    admin.from("submissions").select("submitted_date, last_status_at, current_status_id, candidate_email").eq("recruiter_id", recruiterId),
    admin.from("submission_status_history").select("new_status_id, submissions!inner(recruiter_id)").eq("submissions.recruiter_id", recruiterId),
    admin.from("daily_activity").select("activity_date, resumes_sourced, applicants_parsed").eq("recruiter_id", recruiterId).gte("activity_date", wStart).lte("activity_date", wEnd),
    // all-time client submissions = sum of the 'client_submissions' daily metric this recruiter logged
    admin.from("daily_activity_values").select("value, daily_metrics!inner(key)").eq("recruiter_id", recruiterId).eq("daily_metrics.key", "client_submissions"),
  ]);

  const clientSubmissionsTotal = ((clientSubRows ?? []) as any[]).reduce((n, r) => n + (r.value ?? 0), 0);

  const closureSet = new Set((statuses ?? []).filter((s: any) => s.counts_as_closure).map((s: any) => s.id));
  const S = subs ?? [];

  let submissionsWeek = 0, submissionsMonth = 0, closuresTotal = 0, closuresMonth = 0, monthWithEmail = 0;
  for (const s of S as any[]) {
    if (inRange(s.submitted_date, wStart, wEnd)) submissionsWeek++;
    if (inRange(s.submitted_date, mStart, mEnd)) { submissionsMonth++; if (s.candidate_email) monthWithEmail++; }
    if (closureSet.has(s.current_status_id)) {
      closuresTotal++;
      if (inRange(s.last_status_at, mStart, mEnd)) closuresMonth++;
    }
  }

  const distinctStatuses = new Set((hist ?? []).map((h: any) => h.new_status_id)).size;
  const activityDaysWeek = (activity ?? []).filter((a: any) => (a.resumes_sourced ?? 0) + (a.applicants_parsed ?? 0) > 0).length;
  const qualityPctMonth = submissionsMonth > 0 ? Math.round((monthWithEmail / submissionsMonth) * 100) : 0;

  return {
    submissionsTotal: S.length,
    submissionsWeek, submissionsMonth,
    closuresTotal, closuresMonth,
    clientSubmissionsTotal,
    distinctStatuses, activityDaysWeek,
    qualityPctMonth, submissionsMonthCount: submissionsMonth,
  };
}

// ---- rule evaluation (individual badges only; comparative handled separately) ----
export function earnedPeriodKey(badge: Badge, m: RecruiterMetrics, today: string): string | null {
  const t = badge.threshold ?? 0;
  switch (badge.rule) {
    case "submissions_total": return m.submissionsTotal >= t ? "all" : null;
    case "submissions_week":  return m.submissionsWeek >= t ? isoWeekKey(today) : null;
    case "submissions_month": return m.submissionsMonth >= t ? monthKey(today) : null;
    case "closures_total":    return m.closuresTotal >= t ? "all" : null;
    case "closures_month":    return m.closuresMonth >= t ? monthKey(today) : null;
    case "client_submissions_total": return m.clientSubmissionsTotal >= t ? "all" : null;
    case "distinct_statuses": return m.distinctStatuses >= t ? "all" : null;
    case "activity_days_week":return m.activityDaysWeek >= t ? isoWeekKey(today) : null;
    case "quality_month":     return (m.submissionsMonthCount >= 5 && m.qualityPctMonth >= t) ? monthKey(today) : null;
    // comparative rules are awarded by the cron, not here:
    case "top_submitter_month":
    case "recruiter_of_month": return null;
    default: return null;
  }
}

// Current value & target for a locked badge's progress bar (null => no meaningful bar).
export function badgeProgress(badge: Badge, m: RecruiterMetrics): { current: number; target: number } | null {
  const t = badge.threshold ?? 0;
  const map: Record<string, number> = {
    submissions_total: m.submissionsTotal,
    submissions_week: m.submissionsWeek,
    submissions_month: m.submissionsMonth,
    closures_total: m.closuresTotal,
    closures_month: m.closuresMonth,
    client_submissions_total: m.clientSubmissionsTotal,
    distinct_statuses: m.distinctStatuses,
    activity_days_week: m.activityDaysWeek,
    quality_month: m.qualityPctMonth,
  };
  if (!(badge.rule in map)) return null;
  return { current: map[badge.rule], target: t };
}

// ---- award one recruiter's individual badges; returns newly-awarded rows ----
export async function evaluateAndAward(recruiterId: string, today = istDateStr()) {
  try {
    const admin = createAdminClient();
    const { data: badges } = await admin.from("badges").select("*").eq("is_active", true);
    const list = (badges ?? []) as Badge[];
    if (list.length === 0) return [];

    const metrics = await computeRecruiterMetrics(admin, recruiterId, today);
    const rows: { recruiter_id: string; badge_id: string; period_key: string }[] = [];
    for (const b of list) {
      const key = earnedPeriodKey(b, metrics, today);
      if (key) rows.push({ recruiter_id: recruiterId, badge_id: b.id, period_key: key });
    }
    if (rows.length === 0) return [];

    const { data: inserted } = await admin
      .from("recruiter_badges")
      .upsert(rows, { onConflict: "recruiter_id,badge_id,period_key", ignoreDuplicates: true })
      .select("badge_id");

    // Notify the recruiter about each newly-unlocked badge.
    if (inserted && inserted.length) {
      const byId = new Map(list.map((b) => [b.id, b.name]));
      const names = inserted.map((r: { badge_id: string }) => byId.get(r.badge_id)).filter(Boolean) as string[];
      await notifyBadges(recruiterId, names);
    }
    return inserted ?? [];
  } catch (e) {
    console.log("[badges] evaluateAndAward failed", e);
    return [];
  }
}

// ---- comparative + full sweep (cron) ----
export async function evaluateComparativeBadges(today = istDateStr()) {
  const admin = createAdminClient();
  const { start: mStart, end: mEnd } = monthBounds(today);
  const mk = monthKey(today);

  const [{ data: badges }, { data: recruiters }, { data: statuses }, { data: subs }] = await Promise.all([
    admin.from("badges").select("*").eq("is_active", true).in("rule", ["top_submitter_month", "recruiter_of_month"]),
    admin.from("profiles").select("id").eq("role", "recruiter").eq("is_active", true),
    admin.from("submission_statuses").select("id, counts_as_closure"),
    admin.from("submissions").select("recruiter_id, current_status_id, submitted_date, last_status_at"),
  ]);

  const closureSet = new Set((statuses ?? []).filter((s: any) => s.counts_as_closure).map((s: any) => s.id));
  const ids = new Set((recruiters ?? []).map((r: any) => r.id));
  const subsByRec: Record<string, number> = {}, closByRec: Record<string, number> = {};
  for (const id of ids) { subsByRec[id as string] = 0; closByRec[id as string] = 0; }
  for (const s of (subs ?? []) as any[]) {
    if (!ids.has(s.recruiter_id)) continue;
    if (inRange(s.submitted_date, mStart, mEnd)) subsByRec[s.recruiter_id]++;
    if (closureSet.has(s.current_status_id) && inRange(s.last_status_at, mStart, mEnd)) closByRec[s.recruiter_id]++;
  }

  const leaders = (map: Record<string, number>): string[] => {
    const max = Math.max(0, ...Object.values(map));
    if (max <= 0) return [];
    return Object.entries(map).filter(([, v]) => v === max).map(([k]) => k);
  };

  const rows: { recruiter_id: string; badge_id: string; period_key: string }[] = [];
  for (const b of (badges ?? []) as Badge[]) {
    const winners = b.rule === "top_submitter_month" ? leaders(subsByRec) : leaders(closByRec);
    for (const w of winners) rows.push({ recruiter_id: w, badge_id: b.id, period_key: mk });
  }
  if (rows.length === 0) return { awarded: 0 };
  const { data } = await admin.from("recruiter_badges")
    .upsert(rows, { onConflict: "recruiter_id,badge_id,period_key", ignoreDuplicates: true })
    .select("recruiter_id, badge_id");

  // Notify each winner of their monthly medal/badge.
  const nameById = new Map(((badges ?? []) as Badge[]).map((b) => [b.id, b.name]));
  for (const row of (data ?? []) as { recruiter_id: string; badge_id: string }[]) {
    const name = nameById.get(row.badge_id);
    if (name) await notifyBadges(row.recruiter_id, [name]);
  }
  return { awarded: data?.length ?? 0 };
}

// Full nightly sweep: individual badges for everyone + comparative.
export async function evaluateAllRecruiters(today = istDateStr()) {
  const admin = createAdminClient();
  const { data: recruiters } = await admin.from("profiles").select("id").eq("role", "recruiter").eq("is_active", true);
  let newAwards = 0;
  for (const r of (recruiters ?? []) as any[]) {
    const got = await evaluateAndAward(r.id, today);
    newAwards += got.length;
  }
  const comp = await evaluateComparativeBadges(today);
  return { recruiters: (recruiters ?? []).length, individualAwards: newAwards, comparativeAwards: comp.awarded };
}
