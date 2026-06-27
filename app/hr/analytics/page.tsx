import { createAdminClient } from "@/lib/supabase/admin";
import { istDateStr, monthBounds, asUtc } from "@/lib/dates";
import IncentiveAnalytics from "@/components/hr/IncentiveAnalytics";

export const dynamic = "force-dynamic";

const APPROVED = new Set(["hr_approved", "initiated"]); // counted as approved spend

export default async function HrAnalyticsPage() {
  const admin = createAdminClient();
  const today = istDateStr();
  const { start: mStart, end: mEnd } = monthBounds(today);

  const { data: rewards } = await admin.from("reward_requests")
    .select("status, amount, currency, division_id, recruiter_id, hr_decided_at")
    .limit(5000);
  const rows = (rewards ?? []) as Array<Record<string, any>>;

  const divIds = Array.from(new Set(rows.map((r) => r.division_id).filter(Boolean) as string[]));
  const recIds = Array.from(new Set(rows.map((r) => r.recruiter_id).filter(Boolean) as string[]));
  const divById = new Map<string, string>();
  const recById = new Map<string, string>();
  if (divIds.length) {
    const { data } = await admin.from("divisions").select("id, name").in("id", divIds);
    for (const d of (data ?? []) as { id: string; name: string }[]) divById.set(d.id, d.name);
  }
  if (recIds.length) {
    const { data } = await admin.from("profiles").select("id, full_name").in("id", recIds);
    for (const p of (data ?? []) as { id: string; full_name: string }[]) recById.set(p.id, p.full_name);
  }

  const counts = { pending: 0, approved: 0, paid: 0, declined: 0 };
  const totalsAll = { INR: 0, USD: 0 };
  const totalsMonth = { INR: 0, USD: 0 };
  const divAgg = new Map<string, { name: string; INR: number; USD: number; count: number }>();
  const recAgg = new Map<string, { name: string; INR: number; USD: number; count: number }>();

  for (const r of rows) {
    if (r.status === "manager_confirmed") counts.pending++;
    else if (r.status === "hr_approved") counts.approved++;
    else if (r.status === "initiated") counts.paid++;
    else if (r.status === "hr_rejected") counts.declined++;

    if (!APPROVED.has(r.status)) continue;
    const cur: "INR" | "USD" | null = r.currency === "USD" ? "USD" : r.currency === "INR" ? "INR" : null;
    const amt = Number(r.amount) || 0;
    if (!cur || amt <= 0) continue;

    totalsAll[cur] += amt;
    const decided = (r.hr_decided_at as string | null)?.slice(0, 10);
    if (decided && decided >= mStart && decided <= mEnd) totalsMonth[cur] += amt;

    const dKey = r.division_id ?? "none";
    const dName = r.division_id ? divById.get(r.division_id) ?? "Unknown" : "—";
    const d = divAgg.get(dKey) ?? { name: dName, INR: 0, USD: 0, count: 0 };
    d[cur] += amt; d.count++; divAgg.set(dKey, d);

    const rKey = r.recruiter_id ?? "none";
    const rName = r.recruiter_id ? recById.get(r.recruiter_id) ?? "Unknown" : "—";
    const rr = recAgg.get(rKey) ?? { name: rName, INR: 0, USD: 0, count: 0 };
    rr[cur] += amt; rr.count++; recAgg.set(rKey, rr);
  }

  const sortBySpend = (a: { INR: number; USD: number }, b: { INR: number; USD: number }) => (b.INR + b.USD) - (a.INR + a.USD);
  const byDivision = Array.from(divAgg.values()).sort(sortBySpend);
  const byRecruiter = Array.from(recAgg.values()).sort(sortBySpend).slice(0, 8);

  const monthLabel = asUtc(mStart).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <IncentiveAnalytics
      counts={counts}
      totalsAll={totalsAll}
      totalsMonth={totalsMonth}
      byDivision={byDivision}
      byRecruiter={byRecruiter}
      monthLabel={monthLabel}
    />
  );
}
