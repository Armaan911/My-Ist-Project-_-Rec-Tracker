"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { mintDailyToken } from "@/lib/dailyToken";

// Mint a FRESH single-use daily-form link for a recruiter. Each call returns a new
// token (links are dynamic — they change every click, work once, expire in 20h).
// Same link the 3 AM IST cron emails; managers and admins can copy it on demand.
export async function createDailyLink(recruiterId: string) {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "manager")) return { ok: false, error: "Not authorized" };
  const admin = createAdminClient();
  const res = await mintDailyToken(admin, recruiterId);
  if (res.ok) await logAudit(me.id, "daily_link.create", "profiles", recruiterId, { for_date: res.forDate, by: me.role });
  return res;
}
