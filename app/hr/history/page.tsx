import { createAdminClient } from "@/lib/supabase/admin";
import IncentiveHistory from "@/components/hr/IncentiveHistory";

export const dynamic = "force-dynamic";

// Full incentive history with payout status. HR + admin (page is gated by the /hr layout).
export default async function HrHistoryPage() {
  const admin = createAdminClient();
  const { data: rewards } = await admin.from("reward_requests")
    .select("id, status, candidate_name, requirement_title, recruiter_id, manager_id, hr_id, amount, currency, hr_comment, created_at, hr_decided_at, initiated_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (rewards ?? []) as Array<Record<string, any>>;
  const ids = Array.from(new Set(rows.flatMap((r) => [r.recruiter_id, r.manager_id, r.hr_id].filter(Boolean) as string[])));
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", ids);
    for (const p of (profs ?? []) as { id: string; full_name: string }[]) nameById.set(p.id, p.full_name);
  }

  const enriched = rows.map((r) => ({
    id: r.id,
    status: r.status,
    candidate_name: r.candidate_name ?? null,
    requirement_title: r.requirement_title ?? null,
    recruiter_name: nameById.get(r.recruiter_id) ?? "—",
    manager_name: r.manager_id ? nameById.get(r.manager_id) ?? "—" : null,
    hr_name: r.hr_id ? nameById.get(r.hr_id) ?? "—" : null,
    amount: r.amount ?? null,
    currency: r.currency ?? null,
    hr_comment: r.hr_comment ?? null,
    created_at: r.created_at,
    hr_decided_at: r.hr_decided_at ?? null,
    initiated_at: r.initiated_at ?? null,
  }));

  return <IncentiveHistory rows={enriched} />;
}
