"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { istDateStr, monthBounds, addDays } from "@/lib/dates";

const esc = (v: any) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Per-recruiter performance for a month as CSV. Headline KPIs: internal submissions,
// client submissions, closures — plus the rest of the daily activity for context.
// Admin or manager only. `divisionId` optional to scope to one division.
export async function buildPerformanceCsv(input?: { month?: string; divisionId?: string | null; period?: "today" | "week" | "month" }) {
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "manager")) return { ok: false as const, error: "Not authorized" };

  // Same full per-recruiter breakdown for any granularity — only the date window changes.
  const period = input?.period ?? "month";
  const todayStr = istDateStr();
  let start: string, end: string, periodTag: string;
  if (period === "today") {
    start = end = todayStr; periodTag = todayStr;
  } else if (period === "week") {
    end = todayStr; start = addDays(todayStr, -6); periodTag = `week-ending-${todayStr}`;
  } else {
    const month = input?.month ?? todayStr.slice(0, 7); // YYYY-MM
    const b = monthBounds(month + "-01"); start = b.start; end = b.end; periodTag = month;
  }
  const db = createAdminClient();

  const [{ data: recruiters }, { data: divisions }, { data: metrics }, { data: values }, { data: statuses }, { data: subs }, { data: memberRows }] =
    await Promise.all([
      db.from("profiles").select("id, full_name, division_id, monthly_submission_target, monthly_closure_target").eq("role", "recruiter").eq("is_active", true),
      db.from("divisions").select("id, name"),
      db.from("daily_metrics").select("id, key"),
      db.from("daily_activity_values").select("recruiter_id, metric_id, value").gte("activity_date", start).lte("activity_date", end),
      db.from("submission_statuses").select("id, counts_as_closure"),
      db.from("submissions").select("recruiter_id, current_status_id, submitted_date, last_status_at"),
      db.from("profile_divisions").select("profile_id, division_id"),
    ]);

  // full division membership (primary + profile_divisions), to match the dashboard scope
  const divsByRec = new Map<string, Set<string>>();
  for (const r of (recruiters ?? []) as any[]) { const s = new Set<string>(); if (r.division_id) s.add(r.division_id); divsByRec.set(r.id, s); }
  for (const m of (memberRows ?? []) as any[]) { if (!divsByRec.has(m.profile_id)) divsByRec.set(m.profile_id, new Set()); divsByRec.get(m.profile_id)!.add(m.division_id); }

  const divName = new Map((divisions ?? []).map((d: any) => [d.id, d.name]));
  const keyByMetric = new Map((metrics ?? []).map((m: any) => [m.id, m.key]));
  const closureSet = new Set((statuses ?? []).filter((s: any) => s.counts_as_closure).map((s: any) => s.id));
  const inMonth = (d: string | null) => !!d && d >= start && d <= end;

  // sum daily metric values per recruiter, keyed by metric key
  const sums = new Map<string, Record<string, number>>();
  for (const v of (values ?? []) as any[]) {
    const key = keyByMetric.get(v.metric_id); if (!key) continue;
    if (!sums.has(v.recruiter_id)) sums.set(v.recruiter_id, {});
    const rec = sums.get(v.recruiter_id)!;
    rec[key] = (rec[key] ?? 0) + (v.value ?? 0);
  }

  // structured submissions + closures per recruiter (source of truth from submissions table)
  const subCount = new Map<string, number>();
  const closeCount = new Map<string, number>();
  for (const s of (subs ?? []) as any[]) {
    if (inMonth(s.submitted_date)) subCount.set(s.recruiter_id, (subCount.get(s.recruiter_id) ?? 0) + 1);
    if (closureSet.has(s.current_status_id) && inMonth(s.last_status_at)) closeCount.set(s.recruiter_id, (closeCount.get(s.recruiter_id) ?? 0) + 1);
  }

  const scope = input?.divisionId ?? null;
  const rows = (recruiters ?? [])
    .filter((r: any) => !scope || (divsByRec.get(r.id)?.has(scope) ?? false))
    .map((r: any) => {
      const m = sums.get(r.id) ?? {};
      return {
        name: r.full_name,
        division: divName.get(r.division_id) ?? "—",
        internal: m["internal_submissions"] ?? 0,
        client: m["client_submissions"] ?? 0,
        closures: closeCount.get(r.id) ?? 0,
        subTarget: r.monthly_submission_target ?? "",
        closureTarget: r.monthly_closure_target ?? "",
        totalSubs: subCount.get(r.id) ?? 0,
        sourced: m["profiles_sourced"] ?? 0,
        parsed: m["resumes_parsed"] ?? 0,
        rtr: m["rtr_count"] ?? 0,
        techSched: m["tech_scheduled"] ?? 0,
        techCond: m["tech_conducted"] ?? 0,
      };
    })
    .sort((a, b) => b.closures - a.closures || b.client - a.client || b.internal - a.internal);

  const header = [
    "Recruiter", "Division", "Internal submissions", "Client submissions", "Closures",
    "Submission target", "Closure target", "Total submissions (logged)",
    "Resumes sourced", "Resumes parsed", "RTR taken", "Tech scheduled", "Tech conducted",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      r.name, r.division, r.internal, r.client, r.closures, r.subTarget, r.closureTarget,
      r.totalSubs, r.sourced, r.parsed, r.rtr, r.techSched, r.techCond,
    ].map(esc).join(","));
  }
  // totals row
  if (rows.length) {
    const sum = (k: keyof (typeof rows)[number]) => rows.reduce((n, r) => n + (Number(r[k]) || 0), 0);
    lines.push(["TOTAL", "", sum("internal"), sum("client"), sum("closures"), "", "", sum("totalSubs"), sum("sourced"), sum("parsed"), sum("rtr"), sum("techSched"), sum("techCond")].map(esc).join(","));
  }

  return { ok: true as const, filename: `recruiter-performance-${periodTag}${scope ? "-scoped" : ""}.csv`, csv: lines.join("\n") };
}
