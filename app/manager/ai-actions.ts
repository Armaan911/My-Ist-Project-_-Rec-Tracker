"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { geminiGenerate } from "@/lib/gemini";
import { istDateStr, addDays, inRange, monthBounds } from "@/lib/dates";

const HL_CACHE = "team_highlight";
const isErrorish = (t: string) => /^AI (error|request failed|summary unavailable)/i.test(t.trim());

// Plain-English weekly team summary (manager/admin/HR). Cached ~3h so it isn't regenerated on
// every dashboard load — that auto-generation was the single biggest AI token drain.
export async function generateTeamSummary(force = false) {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "manager" && me.role !== "hr")) return { ok: false, text: "Not authorized." };
  const supabase = createAdminClient();

  const { data: cachedRow } = await supabase.from("app_settings").select("value").eq("key", HL_CACHE).maybeSingle();
  const cached = (cachedRow?.value ?? null) as { text?: string; at?: string } | null;
  if (!force && cached?.text && cached.at && Date.now() - Date.parse(cached.at) < 3 * 60 * 60 * 1000) {
    return { ok: true, text: cached.text };
  }

  const today = istDateStr();
  const weekStart = addDays(today, -7);
  const [{ data: recruiters }, { data: statuses }, { data: subs }, { data: alerts }, { count: openReqs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, monthly_submission_target").eq("role", "recruiter").eq("is_active", true),
    supabase.from("submission_statuses").select("id, counts_as_closure"),
    supabase.from("submissions").select("recruiter_id, current_status_id, submitted_date, last_status_at"),
    supabase.from("alerts").select("title").eq("is_read", false).limit(5),
    supabase.from("requirements").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  const closureSet = new Set((statuses ?? []).filter((s) => s.counts_as_closure).map((s) => s.id));
  const per = (recruiters ?? []).map((r) => {
    let s = 0, c = 0;
    for (const x of subs ?? []) {
      if (x.recruiter_id !== r.id) continue;
      if (inRange(x.submitted_date, weekStart, today)) s++;
      if (closureSet.has(x.current_status_id) && inRange(x.last_status_at, weekStart, today)) c++;
    }
    return { n: r.full_name, s, c, t: r.monthly_submission_target ?? null };
  });
  // Only send active recruiters (capped) + an inactive count — keeps the prompt small.
  const active = per.filter((r) => r.s || r.c).sort((a, b) => (b.c - a.c) || (b.s - a.s)).slice(0, 15);
  const metrics = {
    week: `${weekStart}..${today}`, open_reqs: openReqs ?? 0,
    team_subs: per.reduce((n, r) => n + r.s, 0), team_closures: per.reduce((n, r) => n + r.c, 0),
    active, inactive: per.length - active.length, alerts: (alerts ?? []).map((a) => a.title),
  };

  const prompt = `Recruitment ops assistant. Using ONLY this JSON (keys: n=name, s=submissions, c=closures, t=target), write a 3-4 sentence plain-English weekly update for a manager — no bullets, no preamble: overall flow, who's doing well (name them), who's behind/at risk (name them), ONE concrete suggestion. Don't invent numbers.\n${JSON.stringify(metrics)}`;
  const text = await geminiGenerate(prompt, 320);

  if (!isErrorish(text)) {
    const value = { text, at: new Date().toISOString() };
    if (cachedRow) await supabase.from("app_settings").update({ value }).eq("key", HL_CACHE);
    else await supabase.from("app_settings").insert({ key: HL_CACHE, value });
    return { ok: true, text };
  }
  // On failure (e.g. all keys exhausted), fall back to the last good cached summary.
  return { ok: true, text: cached?.text || text };
}

// Per-recruiter AI insight (manager/admin/HR).
export async function generateRecruiterInsight(recruiterId: string) {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "manager" && me.role !== "hr")) return { ok: false, text: "Not authorized." };
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
  const stage: Record<string, number> = {};
  for (const s of (subs ?? []) as any[]) {
    if (inRange(s.submitted_date, mStart, mEnd)) subMonth++;
    if (inRange(s.submitted_date, pmStart, pmEnd)) subPrev++;
    if (closure.has(s.current_status_id)) {
      if (inRange(s.last_status_at, mStart, mEnd)) clMonth++;
      if (inRange(s.last_status_at, pmStart, pmEnd)) clPrev++;
    }
    const lbl = labelOf.get(s.current_status_id) ?? "Other";
    stage[lbl] = (stage[lbl] ?? 0) + 1;
  }
  const effort: Record<string, number> = {};
  for (const v of (vals ?? []) as any[]) { const l = v.daily_metrics?.label ?? "Activity"; effort[l] = (effort[l] ?? 0) + (v.value ?? 0); }

  const data = {
    r: rec.full_name, sub: subMonth, sub_prev: subPrev, cl: clMonth, cl_prev: clPrev,
    sub_target: rec.monthly_submission_target ?? null, cl_target: rec.monthly_closure_target ?? null,
    pipeline: stage, effort,
  };
  const prompt = `Recruitment team lead. Using ONLY this JSON for one recruiter, write a short specific read for their manager: 3-4 sentences, no bullets, no preamble — tracking vs last month and vs target, where the pipeline is strong/thin, ONE concrete suggestion. Don't invent numbers.\n${JSON.stringify(data)}`;
  const text = await geminiGenerate(prompt, 300);
  return { ok: true, text };
}

// Ask-the-data assistant (manager/admin). Answers from a bounded snapshot; no SQL execution.
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
    supabase.from("alerts").select("title").eq("is_read", false).limit(10),
  ]);

  const divName = new Map((divisions ?? []).map((d: any) => [d.id, d.name]));
  const closure = new Set((statuses ?? []).filter((s: any) => s.counts_as_closure).map((s: any) => s.id));
  const labelOf = new Map((statuses ?? []).map((s: any) => [s.id, s.label]));

  const per = (recruiters ?? []).map((r: any) => {
    let s = 0, c = 0;
    for (const x of (subs ?? []) as any[]) {
      if (x.recruiter_id !== r.id) continue;
      if (inRange(x.submitted_date, mStart, mEnd)) s++;
      if (closure.has(x.current_status_id) && inRange(x.last_status_at, mStart, mEnd)) c++;
    }
    return { n: r.full_name, d: divName.get(r.division_id) ?? "—", s, c };
  });
  const active = per.filter((r) => r.s || r.c).slice(0, 25);

  const reqByStatus: Record<string, number> = {}; const reqByClient: Record<string, number> = {};
  for (const r of (reqs ?? []) as any[]) { reqByStatus[r.status] = (reqByStatus[r.status] ?? 0) + 1; const cn = r.clients?.name ?? "No client"; reqByClient[cn] = (reqByClient[cn] ?? 0) + 1; }
  const stage: Record<string, number> = {};
  for (const s of (subs ?? []) as any[]) { const l = labelOf.get(s.current_status_id) ?? "Other"; stage[l] = (stage[l] ?? 0) + 1; }

  const snapshot = {
    as_of: today, month: `${mStart}..${mEnd}`, divisions: (divisions ?? []).map((d: any) => d.name),
    team_subs: per.reduce((n, r) => n + r.s, 0), team_closures: per.reduce((n, r) => n + r.c, 0),
    recruiters: active, req_by_status: reqByStatus, req_by_client: reqByClient, pipeline: stage, alerts: (alerts ?? []).map((a: any) => a.title),
  };
  const prompt = `Analyst for a recruitment team. Answer the QUESTION using ONLY the DATA (keys: n=name, d=division, s=month submissions, c=month closures). Concise (1-4 sentences). If the data doesn't contain the answer, say so; don't invent numbers.\nQUESTION: ${question.trim()}\nDATA: ${JSON.stringify(snapshot)}`;
  const text = await geminiGenerate(prompt, 300);
  return { ok: true, text };
}
