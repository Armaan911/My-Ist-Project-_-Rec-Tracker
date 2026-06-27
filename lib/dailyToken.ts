import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istDateStr } from "@/lib/dates";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const TOKEN_TTL_HOURS = 20;

// Mint a fresh single-use, date-pinned daily-form token for a recruiter and return
// the raw token (only the SHA-256 hash is stored). Each call produces a brand-new
// token, so links are dynamic — they change on every click and each one works once.
// Used by BOTH the 3 AM IST cron and the manager/admin "copy daily link" buttons,
// so the link a manager copies is identical in kind to the emailed one.
export async function mintDailyToken(
  admin: SupabaseClient,
  recruiterId: string,
  forDate: string = istDateStr()
): Promise<{ ok: true; token: string; forDate: string } | { ok: false; error: string }> {
  const raw = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const { error } = await admin.from("daily_form_tokens").insert({
    recruiter_id: recruiterId,
    token_hash: sha256(raw),
    for_date: forDate,
    expires_at: expires,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, token: raw, forDate };
}
