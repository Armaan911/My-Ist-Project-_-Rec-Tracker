import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ApprovalsList from "@/components/admin/ApprovalsList";
import ClosureApprovals from "@/components/ClosureApprovals";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("change_requests")
    .select("id, entity_type, payload, reason, created_at, profiles:profiles!recruiter_id(full_name)")
    .eq("status", "pending").order("created_at", { ascending: false });

  // Pending closure approvals (all divisions).
  const admin = createAdminClient();
  const { data: cl } = await admin.from("reward_requests")
    .select("id, candidate_name, requirement_title, recruiter_id, created_at")
    .eq("status", "pending_manager").eq("source", "closure")
    .order("created_at", { ascending: false }).limit(200);
  const clRows = (cl ?? []) as Array<Record<string, any>>;
  const ids = Array.from(new Set(clRows.map((r) => r.recruiter_id).filter(Boolean)));
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", ids);
    for (const p of (profs ?? []) as { id: string; full_name: string }[]) nameById.set(p.id, p.full_name);
  }
  const closures = clRows.map((r) => ({
    id: r.id, candidate_name: r.candidate_name ?? null, requirement_title: r.requirement_title ?? null,
    recruiter_name: nameById.get(r.recruiter_id) ?? "—", created_at: r.created_at,
  }));

  return (
    <div className="space-y-6">
      <ClosureApprovals items={closures} />
      <div>
        <h2 className="mb-2 text-lg font-semibold">Past-day change requests</h2>
        <ApprovalsList requests={(data as any) ?? []} />
      </div>
    </div>
  );
}
