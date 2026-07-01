import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import RewardsTracker from "@/components/admin/RewardsTracker";
import IncentiveHistory from "@/components/hr/IncentiveHistory";
import ClosureApprovals from "@/components/ClosureApprovals";

export const dynamic = "force-dynamic";

// Pending closure approvals (source='closure') to confirm — moved here from the Approvals tab.
async function loadClosures(admin: ReturnType<typeof createAdminClient>, myDivs: Set<string> | null) {
  const { data } = await admin.from("reward_requests")
    .select("id, candidate_name, requirement_title, recruiter_id, division_id, created_at")
    .eq("status", "pending_manager").eq("source", "closure")
    .order("created_at", { ascending: false }).limit(200);
  let rows = (data ?? []) as Array<Record<string, any>>;
  if (myDivs) rows = rows.filter((r) => r.division_id && myDivs.has(r.division_id));
  const ids = Array.from(new Set(rows.map((r) => r.recruiter_id).filter(Boolean)));
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", ids);
    for (const p of (profs ?? []) as { id: string; full_name: string }[]) nameById.set(p.id, p.full_name);
  }
  return rows.map((r) => ({
    id: r.id, candidate_name: r.candidate_name ?? null, requirement_title: r.requirement_title ?? null,
    recruiter_name: nameById.get(r.recruiter_id) ?? "—", created_at: r.created_at,
  }));
}

export default async function ManagerRewardsPage() {
  const me = await getProfile();
  const admin = createAdminClient();

  const { data: rewards } = await admin
    .from("reward_requests")
    .select("id, status, candidate_name, requirement_title, recruiter_id, division_id, manager_id, hr_id, manager_confirmed_at, hr_email, hr_decided_at, initiated_at, note, amount, currency, hr_comment, source, created_at")
    .eq("source", "recruiter_request")
    .order("created_at", { ascending: false })
    .limit(300);

  let rows = (rewards as Array<Record<string, unknown>>) ?? [];

  const isManager = me?.role === "manager";
  let myDivs: Set<string> | null = null;
  if (isManager) {
    const { data: pd } = await admin.from("profile_divisions").select("division_id").eq("profile_id", me!.id);
    myDivs = new Set<string>(((pd ?? []) as { division_id: string }[]).map((r) => r.division_id));
    if (me!.division_id) myDivs.add(me!.division_id);
    const divs = myDivs;
    rows = rows.filter((r) => r.division_id && divs.has(r.division_id as string));
  }
  const closures = await loadClosures(admin, myDivs);

  // resolve recruiter + manager + hr display names
  const ids = Array.from(new Set(rows.flatMap((r) => [r.recruiter_id, r.manager_id, r.hr_id].filter(Boolean) as string[])));
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", ids);
    for (const p of (profs ?? []) as { id: string; full_name: string }[]) nameById.set(p.id, p.full_name);
  }

  const enriched = rows.map((r) => ({
    ...r,
    recruiter_name: nameById.get(r.recruiter_id as string) ?? "—",
    manager_name: r.manager_id ? nameById.get(r.manager_id as string) ?? "—" : null,
  }));

  const historyRows = rows.map((r) => ({
    id: r.id as string,
    status: r.status as string,
    candidate_name: (r.candidate_name as string) ?? null,
    requirement_title: (r.requirement_title as string) ?? null,
    recruiter_name: nameById.get(r.recruiter_id as string) ?? "—",
    manager_name: r.manager_id ? nameById.get(r.manager_id as string) ?? "—" : null,
    hr_name: r.hr_id ? nameById.get(r.hr_id as string) ?? "—" : null,
    amount: (r.amount as number) ?? null,
    currency: (r.currency as string) ?? null,
    hr_comment: (r.hr_comment as string) ?? null,
    created_at: r.created_at as string,
    hr_decided_at: (r.hr_decided_at as string) ?? null,
    initiated_at: (r.initiated_at as string) ?? null,
  }));

  return (
    <div className="space-y-10">
      <ClosureApprovals items={closures} />
      <RewardsTracker
        rewards={enriched as never}
        hint={isManager ? "Incentive requests from your recruiters — approve, send to HR, and track to payout." : "Incentive requests across the company."}
      />
      <IncentiveHistory
        rows={historyRows}
        canMarkPaid={!isManager}
        subtitle={isManager ? "Incentive requests for your division — export for finance." : "Incentive requests across the company — export for finance."}
      />
    </div>
  );
}
