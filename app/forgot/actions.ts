"use server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

// Self-service "forgot password": generate a recovery link via the admin API and email it
// through the app's own mailer (Microsoft Graph) — the same path the admin reset uses.
// We never reveal whether an account exists, but we DO surface a transport failure so a
// broken mail setup isn't silently hidden.
export async function requestPasswordReset(email: string) {
  const e = (email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: "Enter a valid email address." };

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("full_name").ilike("email", e).maybeSingle();

  const host = headers().get("host");
  const origin = process.env.NEXT_PUBLIC_APP_URL || (host ? `https://${host}` : "");
  const { data: gen, error } = await admin.auth.admin.generateLink({ type: "recovery", email: e, options: { redirectTo: `${origin}/reset` } });

  // Unknown email → generateLink errors. Swallow it so we don't leak which emails exist.
  if (error) return { ok: true };
  const link = (gen as { properties?: { action_link?: string } } | null)?.properties?.action_link;
  if (!link) return { ok: true };

  const name = (prof as { full_name?: string } | null)?.full_name ?? "there";
  const sent = await sendEmail(
    e,
    "Reset your Podium password",
    `<p>Hi ${name},</p>
     <p>A password reset was requested for your <b>Podium</b> account. Click the button below to set a new password:</p>
     <p style="margin:20px 0"><a href="${link}" style="background:#068AD3;color:#ffffff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Reset my password</a></p>
     <p style="font-size:12px;color:#666">If the button doesn't work, paste this link into your browser:<br>${link}</p>
     <p style="font-size:12px;color:#666">If you didn't request this, you can safely ignore this email.</p>`,
  );
  if (!sent) return { ok: false, error: "We couldn't send the email right now — please contact your admin." };
  return { ok: true };
}
