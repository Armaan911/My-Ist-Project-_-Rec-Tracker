"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { geminiGenerate } from "@/lib/gemini";
import { istDateStr } from "@/lib/dates";

const DAY = 86400000;

// Manager/admin: a concise AI read of one active requirement's traction.
export async function generateReqInsight(requirementId: string) {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "manager")) return { ok: false, text: "Not authorized." };
  const admin = createAdminClient();
  const today = istDateStr();

  const [{ data: req }, { data: statuses }] = await Promise.all([
    admin.from("requirements").select("id, title, job_code, positions, priority, date_received, status, clients(name), divisions(name)").eq("id", requirementId).maybeSingle(),
    admin.from("submission_statuses").select("id, code, label, counts_as_closure, is_rejection"),
  ]);
  if (!req) return { ok: false, text: "Requirement not found." };
  const { data: subs } = await admin.from("submissions")
    .select("recruiter_id, current_status_id, submitted_date, last_status_at, profiles(full_name)").eq("requirement_id", requirementId);

  const closure = new Set((statuses ?? []).filter((s: any) => s.counts_as_closure).map((s: any) => s.id));
  const rej = new Set((statuses ?? []).filter((s: any) => s.is_rejection).map((s: any) => s.id));
  const labelOf = new Map((statuses ?? []).map((s: any) => [s.id, s.label]));
  const rrId = (statuses ?? []).find((s: any) => s.code === "internal_submitted")?.id;
  const clientId = (statuses ?? []).find((s: any) => s.code === "client_submitted")?.id;

  const byStage: Record<string, number> = {};
  const byRec: Record<string, { rr_submitted: number; client_submitted: number }> = {};
  let total = 0, closures = 0, rejections = 0, lastActivity: string | null = null;
  for (const s of (subs ?? []) as any[]) {
    total++;
    const lbl = labelOf.get(s.current_status_id) ?? "Other";
    byStage[lbl] = (byStage[lbl] ?? 0) + 1;
    const nm = s.profiles?.full_name ?? "Unknown";
    byRec[nm] = byRec[nm] ?? { rr_submitted: 0, client_submitted: 0 };
    if (s.current_status_id === rrId) byRec[nm].rr_submitted++;
    if (s.current_status_id === clientId) byRec[nm].client_submitted++;
    if (closure.has(s.current_status_id)) closures++;
    if (rej.has(s.current_status_id)) rejections++;
    const act = s.last_status_at ?? s.submitted_date;
    if (act && (!lastActivity || act > lastActivity)) lastActivity = act;
  }

  const r = req as any;
  const ageDays = Math.max(0, Math.round((Date.parse(today) - Date.parse(r.date_received)) / DAY));
  const daysSinceActivity = lastActivity ? Math.max(0, Math.round((Date.parse(today) - Date.parse(lastActivity)) / DAY)) : null;

  const data = {
    requirement: r.title, job_code: r.job_code, client: r.clients?.name ?? null, division: r.divisions?.name ?? null,
    priority: r.priority, positions: r.positions, age_days: ageDays, days_since_last_activity: daysSinceActivity,
    total_submissions: total, closures, rejections,
    fill_rate_pct: r.positions ? Math.round((closures / r.positions) * 100) : null,
    pipeline_by_stage: byStage, by_recruiter: byRec,
  };

  const prompt = `Recruitment delivery analyst. Using ONLY this JSON for ONE requirement, write a concise manager read: 3-5 sentences, no bullets, no preamble — progress (pipeline vs positions, fill rate), whether it's aging without movement (age_days, days_since_last_activity), top-contributing recruiter, and ONE concrete recommendation. Don't invent numbers.\n${JSON.stringify(data)}`;

  const text = await geminiGenerate(prompt, 320);
  return { ok: true, text };
}
