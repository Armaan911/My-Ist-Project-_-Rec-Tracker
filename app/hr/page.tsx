import { createAdminClient } from "@/lib/supabase/admin";
import HrPlate from "@/components/hr/HrPlate";

export const dynamic = "force-dynamic";

// HR "My Plate": incentive requests a manager has confirmed and that await an HR decision.
export default async function HrPlatePage() {
  const admin = createAdminClient();
  const { data: rewards } = await admin.from("reward_requests")
    .select("id, candidate_name, requirement_title, recruiter_id, manager_id, division_id, manager_confirmed_at, created_at, amount, currency, note")
    .eq("status", "manager_confirmed")
    .order("manager_confirmed_at", { ascending: true })
    .limit(200);

  const rows = (rewards ?? []) as Array<Record<string, any>>;
  const ids = Array.from(new Set(rows.flatMap((r) => [r.recruiter_id, r.manager_id].filter(Boolean) as string[])));
  const divIds = Array.from(new Set(rows.map((r) => r.division_id).filter(Boolean) as string[]));

  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", ids);
    for (const p of (profs ?? []) as { id: string; full_name: string }[]) nameById.set(p.id, p.full_name);
  }
  const divById = new Map<string, string>();
  if (divIds.length) {
    const { data: divs } = await admin.from("divisions").select("id, name").in("id", divIds);
    for (const d of (divs ?? []) as { id: string; name: string }[]) divById.set(d.id, d.name);
  }

  const items = rows.map((r) => ({
    id: r.id,
    candidate_name: r.candidate_name ?? null,
    requirement_title: r.requirement_title ?? null,
    recruiter_name: nameById.get(r.recruiter_id) ?? "—",
    manager_name: r.manager_id ? nameById.get(r.manager_id) ?? "—" : null,
    division_name: r.division_id ? divById.get(r.division_id) ?? null : null,
    confirmed_at: r.manager_confirmed_at ?? null,
    created_at: r.created_at,
    amount: r.amount ?? null,
    currency: r.currency ?? null,
    reason: r.note ?? null,
  }));

  return <HrPlate items={items} />;
}
