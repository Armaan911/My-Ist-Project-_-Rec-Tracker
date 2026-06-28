import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import RevenueTracker from "@/components/RevenueTracker";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const me = await getProfile();
  if (!me) redirect("/login");
  // Revenue (profit) is visible to managers and admins only.
  if (me.role !== "manager" && me.role !== "admin") redirect("/manager");

  const admin = createAdminClient();
  const { data: rows } = await admin.from("reward_requests")
    .select("id, recruiter_id, amount, currency, revenue_value, revenue_currency, status, created_at, submissions(candidate_name, requirements(title))")
    .eq("source", "closure")
    .order("created_at", { ascending: false });

  // Closed rate comes from a newer migration; tolerate it not being applied yet so the
  // revenue (profit) figures always render even before the column exists.
  const closedById = new Map<string, { v: number | null; c: string }>();
  const { data: crRows, error: crErr } = await admin.from("reward_requests")
    .select("id, closed_rate, closed_rate_currency").eq("source", "closure");
  if (!crErr) for (const r of (crRows ?? []) as any[]) {
    closedById.set(r.id, { v: r.closed_rate != null ? Number(r.closed_rate) : null, c: r.closed_rate_currency === "USD" ? "USD" : "INR" });
  }

  const recIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.recruiter_id).filter(Boolean)));
  const { data: recs } = recIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", recIds)
    : { data: [] as any[] };
  const nameById = new Map(((recs ?? []) as any[]).map((r) => [r.id, r.full_name]));

  const closures = ((rows ?? []) as any[]).map((r) => ({
    id: r.id as string,
    recruiterId: (r.recruiter_id ?? "none") as string,
    recruiter: nameById.get(r.recruiter_id) ?? "Unknown",
    candidate: (r.submissions as any)?.candidate_name ?? "—",
    requirement: (r.submissions as any)?.requirements?.title ?? "—",
    date: r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
    incentive: r.amount != null ? Number(r.amount) : null,
    incentiveCurrency: r.currency === "USD" ? "USD" : "INR",
    revenueValue: r.revenue_value != null ? Number(r.revenue_value) : null,
    revenueCurrency: r.revenue_currency === "USD" ? "USD" : "INR",
    closedRate: closedById.get(r.id)?.v ?? null,
    closedRateCurrency: closedById.get(r.id)?.c ?? "INR",
  }));

  return <RevenueTracker closures={closures} />;
}
