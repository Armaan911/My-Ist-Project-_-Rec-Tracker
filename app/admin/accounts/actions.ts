"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// Sync a profile's division membership in profile_divisions to exactly `divisionIds`.
async function syncDivisions(admin: ReturnType<typeof createAdminClient>, profileId: string, divisionIds: string[]) {
  const wanted = Array.from(new Set(divisionIds.filter(Boolean)));
  await admin.from("profile_divisions").delete().eq("profile_id", profileId);
  if (wanted.length) {
    await admin.from("profile_divisions").insert(wanted.map((division_id) => ({ profile_id: profileId, division_id })));
  }
}

// The recruiter roster shows up across several role-gated views; refresh them all after
// an account change so a newly created/updated recruiter appears without a hard reload.
function revalidateAccountViews() {
  for (const p of ["/admin/accounts", "/manager/recruiters", "/manager", "/manager/requirements", "/admin/requirements"]) {
    revalidatePath(p);
  }
}

// Admins, HR and the AI team are org-wide — they aren't tied to a division.
const spansAllDivisions = (role: string) => role === "admin" || role === "hr" || role === "ai_team";

export async function createAccount(input: {
  email: string; password: string; full_name: string;
  role: "admin" | "manager" | "recruiter" | "hr" | "ai_team"; division_ids: string[]; monthly_submission_target: number | null;
  is_coordinator?: boolean;
}) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const admin = createAdminClient();

  const divisionIds = (input.division_ids ?? []).filter(Boolean);
  const primary = divisionIds[0] ?? null; // home division stays on profiles.division_id

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email, password: input.password, email_confirm: true, user_metadata: { full_name: input.full_name },
  });
  if (error || !data.user) return { ok: false, error: error?.message ?? "Create failed" };

  const { error: pErr } = await admin.from("profiles").upsert({
    id: data.user.id, email: input.email, full_name: input.full_name,
    role: input.role, division_id: primary, monthly_submission_target: input.monthly_submission_target, is_active: true,
    is_coordinator: input.role === "recruiter" ? !!input.is_coordinator : false,
  }, { onConflict: "id" });
  if (pErr) return { ok: false, error: pErr.message };

  if (!spansAllDivisions(input.role)) await syncDivisions(admin, data.user.id, divisionIds);

  await logAudit(me.id, "account.create", "profiles", data.user.id, { email: input.email, role: input.role, divisions: divisionIds });
  revalidateAccountViews();
  return { ok: true };
}

export async function updateAccount(input: {
  id: string; role: "admin" | "manager" | "recruiter" | "hr" | "ai_team"; division_ids: string[]; monthly_submission_target: number | null; is_active: boolean; avatar_url?: string | null;
  is_coordinator?: boolean;
}) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const admin = createAdminClient();

  const divisionIds = (input.division_ids ?? []).filter(Boolean);
  const primary = spansAllDivisions(input.role) ? null : (divisionIds[0] ?? null);

  const patch: any = {
    role: input.role, division_id: primary, monthly_submission_target: input.monthly_submission_target, is_active: input.is_active,
    is_coordinator: input.role === "recruiter" ? !!input.is_coordinator : false,
  };
  if (input.avatar_url !== undefined) patch.avatar_url = input.avatar_url;

  const { error } = await admin.from("profiles").update(patch).eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  if (spansAllDivisions(input.role)) await admin.from("profile_divisions").delete().eq("profile_id", input.id);
  else await syncDivisions(admin, input.id, divisionIds);

  await logAudit(me.id, "account.update", "profiles", input.id, { role: input.role, is_active: input.is_active, divisions: divisionIds });
  revalidateAccountViews();
  return { ok: true };
}

// Remove a user who has left. Tries a full delete (auth sign-in + profile row); if the
// person has history (submissions, activity, messages, rewards…) that blocks deletion,
// their sign-in is still removed and the account is deactivated instead — so the app's
// reporting/history stays intact. Returns { soft: true } when it had to deactivate.
export async function deleteAccount(input: { id: string }) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  if (me.id === input.id) return { ok: false, error: "You can't delete your own account." };
  const admin = createAdminClient();

  // Revoke sign-in first (best-effort — a profile might have no auth user).
  try { await admin.auth.admin.deleteUser(input.id); } catch {}

  // Drop join rows we own, then try to delete the profile.
  await admin.from("profile_divisions").delete().eq("profile_id", input.id);
  const { error } = await admin.from("profiles").delete().eq("id", input.id);

  if (error) {
    // Dependent history exists — keep the row but deactivate it.
    await admin.from("profiles").update({ is_active: false }).eq("id", input.id);
    await logAudit(me.id, "account.delete_deactivated", "profiles", input.id, { reason: error.message });
    revalidateAccountViews();
    return { ok: true, soft: true as const };
  }
  await logAudit(me.id, "account.delete", "profiles", input.id, {});
  revalidateAccountViews();
  return { ok: true, soft: false as const };
}

// Admin sets a new password for a user directly (applies immediately).
// Most reliable path — no email dependency. Admin shares the temp password with the person.
export async function setUserPassword(input: { id: string; password: string }) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  if (!input.password || input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(input.id, { password: input.password });
  if (error) return { ok: false, error: error.message };

  await logAudit(me.id, "account.password_set", "profiles", input.id, {}); // never log the password itself
  return { ok: true };
}

// Admin triggers a password-reset email to the user (they click the link and set their own).
// Requires email to be configured in Supabase Auth; otherwise use setUserPassword instead.
export async function sendPasswordReset(input: { id: string }) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const admin = createAdminClient();

  const { data: prof } = await admin.from("profiles").select("email").eq("id", input.id).maybeSingle();
  const email = (prof as any)?.email;
  if (!email) return { ok: false, error: "No email on file for that account." };

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/reset`;
  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return { ok: false, error: error.message };

  await logAudit(me.id, "account.password_reset_sent", "profiles", input.id, { email });
  return { ok: true };
}
