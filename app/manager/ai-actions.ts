"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { geminiGenerate } from "@/lib/gemini";
import { istDateStr, addDays, inRange } from "@/lib/dates";

// Plain-English weekly team summary across all divisions (manager/admin only).
export async function generateTeamSummary() {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "manager")) return { ok: false, text: "Not authorized." };
  const supabase = createAdminClient();
  const today = istDateStr();
  const weekStart = addDays(today, -7);

  const [{ data: recruiters }, { data: statuses }, { data: subs }, { data: alerts }, { count: openReqs }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, monthly_submission_target").eq("role", "recruiter").eq("is_active", true),
      supabase.from("submission_statuses").select("id, counts_as_closure"),
      supabase.from("submissions").select("recruiter_id, current_status_id, submitted_date, last_status_at"),
      supabase.from("alerts").select("title").eq("is_read", false),
      supabase.from("requirements").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);

  const closureSet = new Set((statuses ?? []).filter((s) => s.counts_as_closure).map((s) => s.id));
  const perRecruiter = (recruiters ?? []).map((r) => {
    let weekSubs = 0, weekClosures = 0;
    for (const s of subs ?? []) {
      if (s.recruiter_id !== r.id) continue;
      if (inRange(s.submitted_date, weekStart, today)) weekSubs++;
      if (closureSet.has(s.current_status_id) && inRange(s.last_status_at, weekStart, today)) weekClosures++;
    }
    return { name: r.full_name, weekSubs, weekClosures, target: r.monthly_submission_target ?? null };
  });

  const metrics = {
    week_window: `${weekStart} to ${today}`,
    open_requirements: openReqs ?? 0,
    team_week_submissions: perRecruiter.reduce((n, r) => n + r.weekSubs, 0),
    team_week_closures: perRecruiter.reduce((n, r) => n + r.weekClosures, 0),
    open_alerts: (alerts ?? []).map((a) => a.title),
    recruiters: perRecruiter,
  };

  const prompt = `You are a recruitment operations assistant. Using ONLY the JSON metrics below,
write a concise plain-English weekly update for a manager (4-6 sentences, no bullet points, no preamble).
Cover: overall business flow this week, who is performing well (name them), who looks behind or at
risk (name them), and ONE concrete suggestion. Do not invent numbers not present in the data.

METRICS:
${JSON.stringify(metrics, null, 2)}`;

  const text = await geminiGenerate(prompt);
  return { ok: true, text };
}

import { monthBounds } from "@/lib/dates";

// Per-recruiter AI insight (manager/admin). Builds that recruiter's month numbers and
// asks Gemini for a short, specific read with one concrete suggestion.
export async function generateRecruiterInsight(recruiterId: string) {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "manager")) return { ok: false, text: "Not authorized." };
  const supabase = createAdminClient();
  const today = istDateStr();
  const { start: mStart, end: mEnd } = monthBounds(today);
  const { start: pmStart, end: pmEnd } = monthBounds(addDays(mStart, -1));

  const [{ data: rec }, { data: statuses }, { data: subs }, { data: vals }] = await Promise.all([
    supabase.from("profiles").select("full_name, monthly_submission_target, monthly_closure_target").eq("id", recruiterId).single(),
    supabase.from("submission_statuses").select("id, label, counts_as_closure"),
    supabase.from("submissions").select("current_status_id, submitted_date, last_status_at").eq("recruiter_id", recruiterId),
    supabase.from("daily_activity_values").select("value, daily_metrics(label)").eq("recruiter_id", recruiterId).gte("activity_date", mStart).lte("activity_date", mEnd),
  ]);
  if (!rec) return { ok: false, text: "Recruiter not found." };

  const closure = new Set((statuses ?? []).filter((s: any) => s.counts_as_closure).map((s: any) => s.id));
  const labelOf = new Map((statuses ?? []).map((s: any) => [s.id, s.label]));
  let subMonth = 0, subPrev = 0, clMonth = 0, clPrev = 0;
  const stageDist: Record<string, number> = {};
  for (const s of (subs ?? []) as any[]) {
    if (inRange(s.submitted_date, mStart, mEnd)) subMonth++;
    if (inRange(s.submitted_date, pmStart, pmEnd)) subPrev++;
    if (closure.has(s.current_status_id)) {
      if (inRange(s.last_status_at, mStart, mEnd)) clMonth++;
      if (inRange(s.last_status_at, pmStart, pmEnd)) clPrev++;
    }
    const lbl = labelOf.get(s.current_status_id) ?? "Other";
    stageDist[lbl] = (stageDist[lbl] ?? 0) + 1;
  }
  const effort: Record<string, number> = {};
  for (const v of (vals ?? []) as any[]) {
    const lbl = v.daily_metrics?.label ?? "Activity";
    effort[lbl] = (effort[lbl] ?? 0) + (v.value ?? 0);
  }

  const data = {
    recruiter: rec.full_name,
    month_submissions: subMonth, prev_month_submissions: subPrev,
    month_closures: clMonth, prev_month_closures: clPrev,
    submission_target: rec.monthly_submission_target ?? null,
    closure_target: rec.monthly_closure_target ?? null,
    pipeline_by_stage: stageDist,
    daily_effort_this_month: effort,
  };

  const prompt = `You are a recruitment team lead. Using ONLY the JSON below for one recruiter,
write a short, specific performance read for their manager: 3-4 sentences, no bullet points,
no preamble. Mention how they're tracking vs last month and vs target, where their pipeline is
strong or thin, and end with ONE concrete, actionable suggestion. Do not invent numbers.

DATA:
${JSON.stringify(data, null, 2)}`;

  const text = await geminiGenerate(prompt);
  return { ok: true, text };
}

// Ask-the-data assistant (manager/admin). Answers a natural-language question using a
// bounded snapshot of current team data. No SQL execution — Gemini only sees the snapshot.
export async function askData(question: string) {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "manager")) return { ok: false, text: "Not authorized." };
  if (!question || question.trim().length < 3) return { ok: false, text: "Ask a question first." };
  const supabase = createAdminClient();
  const today = istDateStr();
  const { start: mStart, end: mEnd } = monthBounds(today);

  const [{ data: recruiters }, { data: statuses }, { data: subs }, { data: reqs }, { data: divisions }, { data: alerts }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, division_id").eq("role", "recruiter").eq("is_active", true),
    supabase.from("submission_statuses").select("id, label, counts_as_closure"),
    supabase.from("submissions").select("recruiter_id, division_id, current_status_id, submitted_date, last_status_at"),
    supabase.from("requirements").select("status, division_id, clients(name)"),
    supabase.from("divisions").select("id, name"),
    supabase.from("alerts").select("title").eq("is_read", false).limit(20),
  ]);

  const divName = new Map((divisions ?? []).map((d: any) => [d.id, d.name]));
  const closure = new Set((statuses ?? []).filter((s: any) => s.counts_as_closure).map((s: any) => s.id));
  const labelOf = new Map((statuses ?? []).map((s: any) => [s.id, s.label]));

  const perRecruiter = (recruiters ?? []).map((r: any) => {
    let subMonth = 0, clMonth = 0;
    for (const s of (subs ?? []) as any[]) {
      if (s.recruiter_id !== r.id) continue;
      if (inRange(s.submitted_date, mStart, mEnd)) subMonth++;
      if (closure.has(s.current_status_id) && inRange(s.last_status_at, mStart, mEnd)) clMonth++;
    }
    return { name: r.full_name, division: divName.get(r.division_id) ?? "—", month_submissions: subMonth, month_closures: clMonth };
  });

  const reqByStatus: Record<string, number> = {};
  const reqByClient: Record<string, number> = {};
  for (const r of (reqs ?? []) as any[]) {
    reqByStatus[r.status] = (reqByStatus[r.status] ?? 0) + 1;
    const cn = r.clients?.name ?? "No client";
    reqByClient[cn] = (reqByClient[cn] ?? 0) + 1;
  }
  const stageDist: Record<string, number> = {};
  for (const s of (subs ?? []) as any[]) {
    const lbl = labelOf.get(s.current_status_id) ?? "Other";
    stageDist[lbl] = (stageDist[lbl] ?? 0) + 1;
  }

  const snapshot = {
    as_of: today,
    month_window: `${mStart} to ${mEnd}`,
    divisions: (divisions ?? []).map((d: any) => d.name),
    team_month_submissions: perRecruiter.reduce((n, r) => n + r.month_submissions, 0),
    team_month_closures: perRecruiter.reduce((n, r) => n + r.month_closures, 0),
    recruiters: perRecruiter,
    requirements_by_status: reqByStatus,
    requirements_by_client: reqByClient,
    pipeline_by_stage: stageDist,
    open_alerts: (alerts ?? []).map((a: any) => a.title),
  };

  const prompt = `You are an analyst for a recruitment team. Answer the user's QUESTION using ONLY the
DATA snapshot below. Be concise and direct (1-4 sentences). If the data does not contain the
answer, say so plainly and suggest what to check — do not guess or invent numbers.

QUESTION: ${question.trim()}

DATA:
${JSON.stringify(snapshot, null, 2)}`;

  const text = await geminiGenerate(prompt);
  return { ok: true, text };
}
