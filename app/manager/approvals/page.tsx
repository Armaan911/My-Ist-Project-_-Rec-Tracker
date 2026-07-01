import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import ApprovalsList from "@/components/admin/ApprovalsList";

export const dynamic = "force-dynamic";

// Pending past-day edits. Admins see everything; managers see only requests from
// recruiters in their division(s). Reads via the service role (gated in code), since
// change_requests RLS doesn't grant managers SELECT.
// (Closure/incentive approvals live on the Rewards tab, not here.)
export default async function ManagerApprovalsPage() {
  const me = await getProfile();
  const admin = createAdminClient();

  const { data } = await admin
    .from("change_requests")
    .select("id, entity_type, payload, reason, created_at, recruiter_id, profiles:profiles!recruiter_id(full_name, division_id)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  let rows = (data as Array<{ profiles?: { division_id?: string | null } | null }>) ?? [];

  if (me?.role === "manager") {
    const { data: pd } = await admin.from("profile_divisions").select("division_id").eq("profile_id", me.id);
    const myDivs = new Set<string>(((pd ?? []) as { division_id: string }[]).map((r) => r.division_id));
    if (me.division_id) myDivs.add(me.division_id);
    rows = rows.filter((r) => {
      const div = r.profiles?.division_id ?? null;
      return !!div && myDivs.has(div);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-sm text-muted">
          Past-day edit requests awaiting review{me?.role === "manager" ? " for your division" : ""}.
        </p>
      </div>
      <ApprovalsList requests={rows as never} />
    </div>
  );
}
