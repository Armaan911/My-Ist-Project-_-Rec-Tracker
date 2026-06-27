"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";

// Coordinators (recruiters with coordinator access), managers and admins may verify.
async function ensureCoordinator() {
  const me = (await getProfile()) as any;
  if (!me) return null;
  return me.is_coordinator === true || me.role === "admin" || me.role === "manager" ? me : null;
}

export async function setSubmissionVerified(ids: string[], verified: boolean) {
  const me = await ensureCoordinator();
  if (!me) return { ok: false, error: "Not authorized" };
  if (!ids.length) return { ok: true };
  const admin = createAdminClient();
  const patch = verified ? { verified_by: me.id, verified_at: new Date().toISOString() } : { verified_by: null, verified_at: null };
  const { error } = await admin.from("submissions").update(patch).in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/verify"); revalidatePath("/manager"); revalidatePath("/admin/teams");
  return { ok: true };
}

export async function setDailyVerified(ids: string[], verified: boolean) {
  const me = await ensureCoordinator();
  if (!me) return { ok: false, error: "Not authorized" };
  if (!ids.length) return { ok: true };
  const admin = createAdminClient();
  const patch = verified ? { verified_by: me.id, verified_at: new Date().toISOString() } : { verified_by: null, verified_at: null };
  const { error } = await admin.from("daily_activity").update(patch).in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/verify"); revalidatePath("/manager"); revalidatePath("/admin/teams");
  return { ok: true };
}
