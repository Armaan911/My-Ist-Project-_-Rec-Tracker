import { createAdminClient } from "@/lib/supabase/admin";
import RewardsTracker from "@/components/admin/RewardsTracker";

export const dynamic = "force-dynamic";

// Admin view: every closure reward across the company. Actions live in
// app/manager/rewards/actions (admins are authorized there too).
export default async function AdminRewardsPage() {
  const admin = createAdminClient();
  const { data: rewards } = await admin
    .from("reward_requests")
    .select("id, status, candidate_name, requirement_title, recruiter_id, manager_id, manager_confirmed_at, hr_email, hr_decided_at, initiated_at, note, amount, currency, hr_comment, source, created_at")
    .eq("source", "recruiter_request")
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (rewards as Array<Record<string, unknown>>) ?? [];
  const ids = Array.from(new Set(rows.flatMap((r) => [r.recruiter_id, r.manager_id].filter(Boolean) as string[])));
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

  return <RewardsTracker rewards={enriched as never} hint="Incentive requests across the company. (Closure approvals live in the Approvals tab.)" />;
}
