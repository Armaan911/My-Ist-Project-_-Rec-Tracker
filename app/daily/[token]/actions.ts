"use server";

import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDailyItems, saveDailyItems } from "@/lib/dailyData";
import { evaluateAndAward } from "@/lib/badges";
import type { DailyItem, DailyItemInput } from "@/lib/types";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

// Validate a single-use, date-pinned emailed token. Token-only auth: the token IS
// the credential (single-use + expiring magic link), so no password step.
async function resolve(token: string) {
  const admin = createAdminClient();
  const { data: tok } = await admin
    .from("daily_form_tokens")
    .select("id, recruiter_id, for_date, expires_at, used_at")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (!tok) return { error: "Invalid link." as const };
  if (tok.used_at) return { error: "This link was already used." as const };
  if (new Date(tok.expires_at) < new Date()) return { error: "This link has expired." as const };
  const { data: profile } = await admin
    .from("profiles").select("is_active").eq("id", tok.recruiter_id).single();
  if (!profile?.is_active) return { error: "Account inactive." as const };
  return { tok };
}

export async function loadDailyTokenForm(token: string, _date: string): Promise<{ items: DailyItem[]; locked: boolean }> {
  const r = await resolve(token);
  if ("error" in r) return { items: [], locked: false };
  const admin = createAdminClient();
  const items = await getDailyItems(admin, r.tok.recruiter_id, r.tok.for_date);
  return { items, locked: false };
}

export async function saveDailyTokenForm(token: string, _date: string, items: DailyItemInput[]) {
  const r = await resolve(token);
  if ("error" in r) return { ok: false, error: r.error };
  const admin = createAdminClient();

  const res = await saveDailyItems(admin, r.tok.recruiter_id, r.tok.for_date, items);
  if (!res.ok) return res;

  // NB: token is intentionally NOT consumed here. A daily link must accept several
  // saves in one sitting (counts + multiple candidates), so it stays valid until
  // expires_at rather than being strictly single-use.
  await evaluateAndAward(r.tok.recruiter_id, r.tok.for_date);
  return { ok: true };
}

// Save a candidate submission via the no-login daily link. Uses the token's recruiter
// and that recruiter's home division (matching the logged-in createSubmission), writing
// with the service-role client. Name + LinkedIn are both required.
export async function saveTokenSubmission(token: string, input: {
  requirement_id: string; candidate_name: string; linkedin_url: string; status_id: string; submitted_date: string;
}) {
  const r = await resolve(token);
  if ("error" in r) return { ok: false, error: r.error };
  if (!input.candidate_name?.trim()) return { ok: false, error: "Candidate name is required." };
  if (!input.linkedin_url?.trim()) return { ok: false, error: "LinkedIn URL is required." };
  if (!input.requirement_id) return { ok: false, error: "Pick a requirement." };
  if (!input.status_id) return { ok: false, error: "Pick a status." };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("division_id").eq("id", r.tok.recruiter_id).single();
  if (!profile?.division_id) return { ok: false, error: "Recruiter has no division set." };

  const { data: sub, error } = await admin.from("submissions").insert({
    recruiter_id: r.tok.recruiter_id,
    requirement_id: input.requirement_id,
    division_id: profile.division_id,
    candidate_name: input.candidate_name.trim(),
    linkedin_url: input.linkedin_url.trim(),
    current_status_id: input.status_id,
    submitted_date: input.submitted_date || r.tok.for_date,
  }).select("id").single();
  if (error) return { ok: false, error: error.message };

  await admin.from("submission_status_history").insert({
    submission_id: sub.id, old_status_id: null, new_status_id: input.status_id, changed_by: r.tok.recruiter_id,
  });
  await evaluateAndAward(r.tok.recruiter_id, r.tok.for_date);
  return { ok: true };
}
