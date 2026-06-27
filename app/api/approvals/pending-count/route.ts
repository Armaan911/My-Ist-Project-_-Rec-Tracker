import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Number of pending approval requests the signed-in user can act on:
// admins see all; managers see only their division(s). Returns 0 for everyone else.
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
      const { count: cr } = await admin.from("change_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
      const { count: cl } = await admin.from("reward_requests").select("id", { count: "exact", head: true }).eq("status", "pending_manager").eq("source", "closure");
      return NextResponse.json({ count: (cr ?? 0) + (cl ?? 0) });
    }

    // manager: scope to recruiters in their division(s)
    const { data: pd } = await admin.from("profile_divisions").select("division_id").eq("profile_id", user.id);
    const myDivs = new Set<string>(((pd ?? []) as { division_id: string }[]).map((r) => r.division_id));
    const myPrimary = (me as { division_id?: string | null } | null)?.division_id;
    if (myPrimary) myDivs.add(myPrimary);
    if (myDivs.size === 0) return NextResponse.json({ count: 0 });

    const { data } = await admin
      .from("change_requests")
      .select("id, profiles:profiles!recruiter_id(division_id)")
      .eq("status", "pending");
    const crCount = ((data ?? []) as { profiles?: { division_id?: string | null } | null }[])
      .filter((r) => r.profiles?.division_id && myDivs.has(r.profiles.division_id)).length;
    const { data: clData } = await admin.from("reward_requests").select("division_id").eq("status", "pending_manager").eq("source", "closure");
    const clCount = ((clData ?? []) as { division_id: string | null }[]).filter((r) => r.division_id && myDivs.has(r.division_id)).length;
    return NextResponse.json({ count: crCount + clCount });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
