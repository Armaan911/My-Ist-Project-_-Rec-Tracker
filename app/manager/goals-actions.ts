"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { istDateStr } from "@/lib/dates";

const clampInt = (v: number | null) => (v == null || v === ("" as any) ? null : Math.max(0, Math.trunc(Number(v) || 0)));

// Admin or manager sets a recruiter's submission/closure targets for a month.
// Writes the per-month override (recruiter_goals); the profile target stays the default.
export async function setRecruiterGoals(input: {
  recruiterId: string; submission_target: number | null; closure_target: number | null; month?: string;
}) {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "manager")) return { ok: false, error: "Not authorized" };
  const admin = createAdminClient();

  // Confirm the target is actually a recruiter.
  const { data: rec } = await admin.from("profiles").select("id, role").eq("id", input.recruiterId).maybeSingle();
  if (!rec || rec.role !== "recruiter") return { ok: false, error: "That person isn't a recruiter." };

  const period = input.month ?? istDateStr().slice(0, 7); // 'YYYY-MM'
  const row = {
    recruiter_id: input.recruiterId,
    period_month: period,
    submission_target: clampInt(input.submission_target),
    closure_target: clampInt(input.closure_target),
    set_by: me.id,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("recruiter_goals").upsert(row, { onConflict: "recruiter_id,period_month" });
  if (error) return { ok: false, error: error.message };

  await logAudit(me.id, "recruiter_goal.set", "recruiter_goals", input.recruiterId, { period, ...row });
  revalidatePath("/manager");
  revalidatePath("/dashboard");
  return { ok: true };
}
