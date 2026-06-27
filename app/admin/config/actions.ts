"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function upsertStatus(input: {
  id?: string; code: string; label: string; sort_order: number; counts_as_closure: boolean; is_rejection: boolean; is_terminal: boolean; is_active: boolean;
}) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const supabase = createClient();
  const { error } = input.id
    ? await supabase.from("submission_statuses").update(input).eq("id", input.id)
    : await supabase.from("submission_statuses").insert(input);
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, input.id ? "status.update" : "status.create", "submission_statuses", input.id ?? null, { code: input.code, label: input.label });
  revalidatePath("/admin/config");
  return { ok: true };
}

export async function updateMedalTier(input: { id: string; name: string; min_closures: number; color: string }) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const supabase = createClient();
  const { error } = await supabase.from("medal_tiers").update({ name: input.name, min_closures: input.min_closures, color: input.color }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, "medal.update", "medal_tiers", input.id, input);
  revalidatePath("/admin/config");
  return { ok: true };
}

export async function updateFallingBehind(input: { min_activity_days_per_week: number; min_submissions_per_week: number }) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const supabase = createClient();
  const { error } = await supabase.from("app_settings").update({ value: input, updated_at: new Date().toISOString() }).eq("key", "falling_behind");
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, "settings.update", "app_settings", null, input);
  revalidatePath("/admin/config");
  return { ok: true };
}

export async function updateHrEmail(email: string) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const clean = (email || "").trim();
  if (clean && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { ok: false, error: "Enter a valid email address." };
  const supabase = createClient();
  const { error } = await supabase.from("app_settings")
    .upsert({ key: "hr_email", value: { email: clean }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, "settings.update", "app_settings", null, { hr_email: clean });
  revalidatePath("/admin/config");
  return { ok: true };
}

export async function updateAccountManagerEmail(email: string) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const clean = (email || "").trim();
  if (clean && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { ok: false, error: "Enter a valid email address." };
  const supabase = createClient();
  const { error } = await supabase.from("app_settings")
    .upsert({ key: "account_manager_email", value: { email: clean }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, "settings.update", "app_settings", null, { account_manager_email: clean });
  revalidatePath("/admin/config");
  return { ok: true };
}

export async function updateLeaderboardWeights(input: { submissions: number; closures: number; active_days: number }) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const supabase = createClient();
  const clean = {
    submissions: Math.max(0, Number(input.submissions) || 0),
    closures: Math.max(0, Number(input.closures) || 0),
    active_days: Math.max(0, Number(input.active_days) || 0),
  };
  const { error } = await supabase.from("app_settings")
    .upsert({ key: "leaderboard_weights", value: clean, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, "settings.update", "app_settings", null, { leaderboard_weights: clean });
  revalidatePath("/admin/config");
  return { ok: true };
}
