import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { istDateStr, addDays, monthBounds, asUtc, inRange } from "@/lib/dates";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const today = istDateStr();
  const weekStart = addDays(today, -7);
  const { start: mStart, end: mEnd } = monthBounds(today);
  const dayOfMonth = asUtc(today).getUTCDate();

  const { data: setting } = await admin.from("app_settings").select("value").eq("key", "falling_behind").maybeSingle();
  const rule = (setting?.value as any) ?? { min_activity_days_per_week: 4, min_submissions_per_week: 5 };

  const [{ data: recruiters }, { data: subs }, { data: acts }] = await Promise.all([
    admin.from("profiles").select("id, full_name, division_id, monthly_submission_target").eq("role", "recruiter").eq("is_active", true),
    admin.from("submissions").select("recruiter_id, submitted_date"),
    admin.from("daily_activity").select("recruiter_id, activity_date"),
  ]);

  let created = 0;
  const toInsert: any[] = [];

  for (const r of recruiters ?? []) {
    const subs7 = (subs ?? []).filter((s) => s.recruiter_id === r.id && s.submitted_date >= weekStart).length;
    const days7 = new Set((acts ?? []).filter((a) => a.recruiter_id === r.id && a.activity_date >= weekStart).map((a) => a.activity_date)).size;
    const subsMonth = (subs ?? []).filter((s) => s.recruiter_id === r.id && inRange(s.submitted_date, mStart, mEnd)).length;

    const candidates: { type: string; severity: string; title: string; body: string }[] = [];

    if (subs7 < rule.min_submissions_per_week || days7 < rule.min_activity_days_per_week) {
      candidates.push({
        type: "falling_behind", severity: "warning",
        title: `${r.full_name} may be falling behind`,
        body: `Last 7 days: ${subs7} submissions, active ${days7} day(s). Threshold: ${rule.min_submissions_per_week} subs / ${rule.min_activity_days_per_week} days.`,
      });
    }
    if (r.monthly_submission_target && dayOfMonth >= 20 && subsMonth < r.monthly_submission_target * 0.75) {
      candidates.push({
        type: "target_at_risk", severity: "critical",
        title: `${r.full_name} at risk of missing target`,
        body: `${subsMonth}/${r.monthly_submission_target} submissions with the month nearly over.`,
      });
    }

    for (const c of candidates) {
      const { data: dupe } = await admin.from("alerts").select("id")
        .eq("about_recruiter_id", r.id).eq("type", c.type).gte("created_at", weekStart).limit(1);
      if (dupe && dupe.length) continue;
      toInsert.push({ ...c, about_recruiter_id: r.id, division_id: r.division_id });
      created++;
    }
  }

  if (toInsert.length) {
    await admin.from("alerts").insert(toInsert);
    const { data: admins } = await admin.from("profiles").select("email").eq("role", "admin").eq("is_active", true);
    const emails = (admins ?? []).map((a) => a.email).filter(Boolean);
    if (emails.length) {
      const items = toInsert.map((a) => `<li><b>${a.title}</b><br/>${a.body}</li>`).join("");
      await sendEmail(emails, `Recruit Tracker: ${toInsert.length} new alert(s)`, `<p>New alerts:</p><ul>${items}</ul>`);
    }
  }
  return NextResponse.json({ ok: true, created });
}
