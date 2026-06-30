import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { istDateStr, addDays, prettyDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Runs 03:00 IST (30 21 * * * UTC). Finds active recruiters who didn't log a daily
// update for the day that just ended and notifies: the recruiter ("you haven't…"),
// their division manager(s) and all admins ("X hasn't…").
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const forDate = addDays(istDateStr(), -1); // yesterday (IST) — the day that just closed
  const pretty = prettyDate(forDate, { weekday: "short" });

  const { data: recruiters } = await admin
    .from("profiles").select("id, full_name, division_id").eq("role", "recruiter").eq("is_active", true);
  const recs = (recruiters ?? []) as { id: string; full_name: string; division_id: string | null }[];
  if (recs.length === 0) return NextResponse.json({ ok: true, forDate, missing: 0 });

  // Who logged anything for that date?
  const { data: logged } = await admin.from("daily_activity").select("recruiter_id").eq("activity_date", forDate);
  const loggedSet = new Set(((logged ?? []) as { recruiter_id: string }[]).map((r) => r.recruiter_id));

  const missing = recs.filter((r) => !loggedSet.has(r.id));
  if (missing.length === 0) return NextResponse.json({ ok: true, forDate, missing: 0 });

  // Recipients for escalation.
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin").eq("is_active", true);
  const adminIds = ((admins ?? []) as { id: string }[]).map((a) => a.id);

  const { data: managers } = await admin
    .from("profiles").select("id, division_id").eq("role", "manager").eq("is_active", true);
  const managerList = (managers ?? []) as { id: string; division_id: string | null }[];
  const managerIds = new Set(managerList.map((m) => m.id));
  const { data: pd } = await admin.from("profile_divisions").select("profile_id, division_id");

  // manager id -> set of their division ids (primary + memberships)
  const mgrDivs = new Map<string, Set<string>>();
  for (const m of managerList) {
    const s = mgrDivs.get(m.id) ?? new Set<string>();
    if (m.division_id) s.add(m.division_id);
    mgrDivs.set(m.id, s);
  }
  for (const row of ((pd ?? []) as { profile_id: string; division_id: string }[])) {
    if (!managerIds.has(row.profile_id)) continue;
    const s = mgrDivs.get(row.profile_id) ?? new Set<string>();
    s.add(row.division_id);
    mgrDivs.set(row.profile_id, s);
  }

  // 1) Self-reminders.
  for (const r of missing) {
    await notify({
      userIds: [r.id],
      type: "daily_reminder",
      title: `Daily update missing — ${pretty}`,
      body: `You haven't filled your daily update for ${pretty}. Please log it.`,
      link: "/dashboard",
    });
  }

  // 2) Admins: one summary of everyone who missed.
  if (adminIds.length) {
    await notify({
      userIds: adminIds,
      type: "daily_reminder",
      title: `${missing.length} recruiter${missing.length === 1 ? "" : "s"} missed daily update — ${pretty}`,
      body: missing.map((m) => m.full_name).join(", "),
      link: "/manager/recruiters",
    });
  }

  // 3) Each manager: a summary scoped to their division(s).
  for (const [mgrId, divs] of mgrDivs) {
    const mine = missing.filter((r) => r.division_id && divs.has(r.division_id));
    if (mine.length === 0) continue;
    await notify({
      userIds: [mgrId],
      type: "daily_reminder",
      title: `${mine.length} recruiter${mine.length === 1 ? "" : "s"} missed daily update — ${pretty}`,
      body: mine.map((m) => m.full_name).join(", "),
      link: "/manager/recruiters",
    });
  }

  return NextResponse.json({ ok: true, forDate, missing: missing.length });
}
