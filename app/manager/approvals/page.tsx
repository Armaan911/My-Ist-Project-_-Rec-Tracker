import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import ApprovalsList from "@/components/admin/ApprovalsList";
import ClosureApprovals from "@/components/ClosureApprovals";

export const dynamic = "force-dynamic";

// Pending closure approvals (source='closure'), scoped to the given divisions (null = all).
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

// Pending past-day edits. Admins see everything; managers see only requests from
// recruiters in their division(s). Reads via the service role (gated in code), since
// change_requests RLS doesn't grant managers SELECT.
export default async function ManagerApprovalsPage() {
  const me = await getProfile();
  const admin = createAdminClient();

  const { data } = await admin
    .from("change_requests")
    .select("id, entity_type, payload, reason, created_at, recruiter_id, profiles:profiles!recruiter_id(full_name, division_id)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  let rows = (data as Array<{ profiles?: { division_id?: string | null } | null }>) ?? [];

  let myDivs: Set<string> | null = null;
  if (me?.role === "manager") {
    const { data: pd } = await admin.from("profile_divisions").select("division_id").eq("profile_id", me.id);
    myDivs = new Set<string>(((pd ?? []) as { division_id: string }[]).map((r) => r.division_id));
    if (me.division_id) myDivs.add(me.division_id);
    const divs = myDivs;
    rows = rows.filter((r) => {
      const div = r.profiles?.division_id ?? null;
      return !!div && divs.has(div);
    });
  }

  const closures = await loadClosures(admin, myDivs);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-sm text-muted">
          Past-day edits and closure approvals awaiting review{me?.role === "manager" ? " for your division" : ""}.
        </p>
      </div>
      <ClosureApprovals items={closures} />
      <div>
        <h2 className="mb-2 text-lg font-semibold">Past-day change requests</h2>
        <ApprovalsList requests={rows as never} />
      </div>
    </div>
  );
}
