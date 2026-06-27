import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Count of incentives AWAITING the signed-in manager/admin's decision (status
// 'pending_manager'). Once they confirm or reject, the item leaves this count — so the
// badge decreases on action, exactly like the Approvals badge.
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ count: 0 });

    const { data: me } = await supabase.from("profiles").select("role, division_id").eq("id", user.id).maybeSingle();
    const role = (me as { role?: string } | null)?.role;
    if (role !== "admin" && role !== "manager") return NextResponse.json({ count: 0 });

    const admin = createAdminClient();
    if (role === "admin") {
      const { count } = await admin.from("reward_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_manager").eq("source", "recruiter_request");
      return NextResponse.json({ count: count ?? 0 });
    }

    const { data: pd } = await admin.from("profile_divisions").select("division_id").eq("profile_id", user.id);
    const myDivs = new Set<string>(((pd ?? []) as { division_id: string }[]).map((r) => r.division_id));
    const myPrimary = (me as { division_id?: string | null } | null)?.division_id;
    if (myPrimary) myDivs.add(myPrimary);
    if (myDivs.size === 0) return NextResponse.json({ count: 0 });

    const { data } = await admin.from("reward_requests").select("division_id").eq("status", "pending_manager").eq("source", "recruiter_request");
    const count = ((data ?? []) as { division_id: string | null }[])
      .filter((r) => r.division_id && myDivs.has(r.division_id)).length;
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
