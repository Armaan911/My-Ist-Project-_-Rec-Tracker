import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { istDateStr, addDays, asUtc, monthBounds, inRange } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Period = { period_type: "weekly" | "monthly" | "yearly"; start: string; end: string };

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const today = istDateStr();
  const d = asUtc(today);

  const periods: Period[] = [];
  if (d.getUTCDay() === 1) periods.push({ period_type: "weekly", start: addDays(today, -7), end: addDays(today, -1) }); // Monday -> last week
  if (d.getUTCDate() === 1) { const m = monthBounds(addDays(today, -1)); periods.push({ period_type: "monthly", start: m.start, end: m.end }); }
  if (d.getUTCMonth() === 0 && d.getUTCDate() === 1) {
    const y = d.getUTCFullYear() - 1;
    periods.push({ period_type: "yearly", start: `${y}-01-01`, end: `${y}-12-31` });
  }
  if (!periods.length) return NextResponse.json({ ok: true, finalized: [], note: "no period boundary today" });

  const [{ data: recruiters }, { data: statuses }, { data: subs }] = await Promise.all([
    admin.from("profiles").select("id, division_id").eq("role", "recruiter").eq("is_active", true),
    admin.from("submission_statuses").select("id, counts_as_closure"),
    admin.from("submissions").select("recruiter_id, current_status_id, submitted_date, last_status_at"),
  ]);
  const isClosure = new Set((statuses ?? []).filter((s) => s.counts_as_closure).map((s) => s.id));

  const finalized: string[] = [];
  for (const p of periods) {
    const rows = (recruiters ?? []).map((r) => {
      let closures = 0, submissions = 0;
      for (const s of subs ?? []) {
        if (s.recruiter_id !== r.id) continue;
        if (inRange(s.submitted_date, p.start, p.end)) submissions++;
        if (isClosure.has(s.current_status_id) && inRange(s.last_status_at, p.start, p.end)) closures++;
      }
      return { recruiter_id: r.id, division_id: r.division_id, closures, submissions };
    }).sort((a, b) => b.closures - a.closures || b.submissions - a.submissions);

    const records = rows.map((r, i) => ({
      period_type: p.period_type, period_start: p.start, period_end: p.end,
      recruiter_id: r.recruiter_id, division_id: r.division_id,
      closures: r.closures, submissions: r.submissions,
      rank: i + 1, is_winner: i === 0 && r.closures > 0,
    }));

    // ignoreDuplicates => once finalized, a rerun never overwrites (no drift)
    await admin.from("performance_snapshots").upsert(records, {
      onConflict: "period_type,period_start,recruiter_id", ignoreDuplicates: true,
    });
    finalized.push(`${p.period_type}:${p.start}..${p.end}`);
  }
  return NextResponse.json({ ok: true, finalized });
}
