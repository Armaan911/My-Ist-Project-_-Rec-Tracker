import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Count of incentive requests waiting on HR (status = manager_confirmed).
// Drives the "My Plate" badge. HR + admin only; everyone else sees 0.
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ count: 0 });

    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const role = (me as { role?: string } | null)?.role;
    if (role !== "hr" && role !== "admin") return NextResponse.json({ count: 0 });

    const admin = createAdminClient();
    const { count } = await admin.from("reward_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "manager_confirmed");
    return NextResponse.json({ count: count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
