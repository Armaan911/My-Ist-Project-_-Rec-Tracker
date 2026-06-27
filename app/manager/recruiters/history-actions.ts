"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { addDays, istDateStr } from "@/lib/dates";

export type HistoryDay = {
  date: string;
  activity: { requirement: string; metrics: { label: string; value: number; color: string }[] }[];
  submissions: { candidate: string; status: string; requirement: string }[];
};

// What a recruiter logged, day by day (default last 45 days). Admin/manager only.
export async function getRecruiterDailyHistory(recruiterId: string, days = 45): Promise<{ ok: boolean; days?: HistoryDay[]; error?: string }> {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "manager")) return { ok: false, error: "Not authorized" };

  const today = istDateStr();
  const since = addDays(today, -days);
  const db = createAdminClient();

  const [{ data: values }, { data: subs }] = await Promise.all([
    db.from("daily_activity_values")
      .select("activity_date, value, daily_metrics(label, color, sort_order), requirements(title)")
      .eq("recruiter_id", recruiterId).gte("activity_date", since).order("activity_date", { ascending: false }),
    db.from("submissions")
      .select("candidate_name, submitted_date, submission_statuses(label), requirements(title)")
      .eq("recruiter_id", recruiterId).gte("submitted_date", since).order("submitted_date", { ascending: false }),
  ]);

  const byDate = new Map<string, HistoryDay>();
  const ensure = (d: string) => { if (!byDate.has(d)) byDate.set(d, { date: d, activity: [], submissions: [] }); return byDate.get(d)!; };

  // group activity by date -> requirement
  const reqMap = new Map<string, Map<string, { label: string; value: number; color: string }[]>>();
  for (const v of (values ?? []) as any[]) {
    if ((v.value ?? 0) <= 0) continue;
    const d = v.activity_date;
    if (!reqMap.has(d)) reqMap.set(d, new Map());
    const req = v.requirements?.title ?? "—";
    const m = reqMap.get(d)!;
    if (!m.has(req)) m.set(req, []);
    m.get(req)!.push({ label: v.daily_metrics?.label ?? "—", value: v.value, color: v.daily_metrics?.color ?? "#068AD3" });
  }
  for (const [d, reqs] of reqMap) {
    const day = ensure(d);
    day.activity = [...reqs.entries()].map(([requirement, metrics]) => ({ requirement, metrics }));
  }

  for (const s of (subs ?? []) as any[]) {
    const day = ensure(s.submitted_date);
    day.submissions.push({ candidate: s.candidate_name, status: s.submission_statuses?.label ?? "—", requirement: s.requirements?.title ?? "—" });
  }

  const out = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  return { ok: true, days: out };
}
