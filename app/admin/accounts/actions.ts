"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";

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
  is_coordinator?: boolean; can_import_submissions?: boolean; full_name?: string;
}) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const admin = createAdminClient();

  const divisionIds = (input.division_ids ?? []).filter(Boolean);
  const primary = spansAllDivisions(input.role) ? null : (divisionIds[0] ?? null);

  const patch: any = {
    role: input.role, division_id: primary, monthly_submission_target: input.monthly_submission_target, is_active: input.is_active,
    is_coordinator: input.role === "recruiter" ? !!input.is_coordinator : false,
    can_import_submissions: input.role === "recruiter" ? !!input.can_import_submissions : false,
  };
  if (input.avatar_url !== undefined) patch.avatar_url = input.avatar_url;
  if (input.full_name !== undefined) {
    const nm = input.full_name.trim();
    if (!nm) return { ok: false, error: "Name can't be empty." };
    patch.full_name = nm;
    // keep the auth user_metadata name in sync
    await admin.auth.admin.updateUserById(input.id, { user_metadata: { full_name: nm } });
  }

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

// Admin changes a user's email/login. Updates the auth user (so they sign in with the new
// address) and the profile row. Email stays confirmed so they can log in immediately.
export async function updateUserEmail(input: { id: string; email: string }) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const email = (input.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  const admin = createAdminClient();

  const { data: clash } = await admin.from("profiles").select("id").ilike("email", email).neq("id", input.id).maybeSingle();
  if (clash) return { ok: false, error: "That email is already used by another account." };

  const { error: authErr } = await admin.auth.admin.updateUserById(input.id, { email, email_confirm: true });
  if (authErr) return { ok: false, error: authErr.message };
  const { error: pErr } = await admin.from("profiles").update({ email }).eq("id", input.id);
  if (pErr) return { ok: false, error: pErr.message };

  await logAudit(me.id, "account.email_update", "profiles", input.id, { email });
  revalidateAccountViews();
  return { ok: true };
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

// Admin emails the user a unique password-reset link. We generate the recovery link via the
// admin API and send it through the app's own mailer (Microsoft Graph), so it doesn't depend
// on Supabase's SMTP being configured. The link lands on /reset, where they set a new password.
export async function sendPasswordReset(input: { id: string }) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const admin = createAdminClient();

  const { data: prof } = await admin.from("profiles").select("email, full_name").eq("id", input.id).maybeSingle();
  const email = (prof as any)?.email as string | undefined;
  const name = (prof as any)?.full_name ?? "there";
  if (!email) return { ok: false, error: "No email on file for that account." };

  // Send the reset from the acting admin's own mailbox (falls back to the default mailbox
  // if that address can't send via Graph).
  const { data: meProf } = await admin.from("profiles").select("email").eq("id", me.id).maybeSingle();
  const fromEmail = (meProf as { email?: string } | null)?.email || undefined;

  const host = headers().get("host");
  const origin = process.env.NEXT_PUBLIC_APP_URL || (host ? `https://${host}` : "");
  const { data: gen, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: `${origin}/reset` } });
  if (error) return { ok: false, error: error.message };
  const link = (gen as any)?.properties?.action_link as string | undefined;
  if (!link) return { ok: false, error: "Could not generate the reset link." };

  const sent = await sendEmail(
    email,
    "Reset your Podium password",
    `<p>Hi ${name},</p>
     <p>A password reset was requested for your <b>Podium</b> account. Click the button below to set a new password:</p>
     <p style="margin:20px 0"><a href="${link}" style="background:#068AD3;color:#ffffff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Reset my password</a></p>
     <p style="font-size:12px;color:#666">If the button doesn't work, paste this link into your browser:<br>${link}</p>
     <p style="font-size:12px;color:#666">If you didn't expect this, you can safely ignore this email.</p>`,
    { from: fromEmail },
  );

  await logAudit(me.id, "account.password_reset_sent", "profiles", input.id, { email, sent });
  if (!sent) return { ok: false, error: "The reset link couldn't be emailed — email transport (Microsoft Graph / Resend) isn't working." };
  return { ok: true };
}
