import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { istDateStr } from "@/lib/dates";
import RecruiterPerformance from "@/components/RecruiterPerformance";

export const dynamic = "force-dynamic";

// HR recruiter-performance review, scoped to the HR user's domain (division). Admins see all.
export default async function HrPerformancePage() {
  const me = await getProfile();
  if (!me) redirect("/login");
  if (me.role !== "hr" && me.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const divisionId = me.role === "hr" ? ((me as { division_id?: string | null }).division_id ?? null) : null;

  let recruiters: { id: string; full_name: string }[] = [];
  if (divisionId) {
    const { data: pd } = await admin.from("profile_divisions").select("profile_id").eq("division_id", divisionId);
    const ids = ((pd ?? []) as { profile_id: string }[]).map((r) => r.profile_id);
    if (ids.length) {
      const { data } = await admin.from("profiles").select("id, full_name").eq("role", "recruiter").eq("is_active", true).in("id", ids);
      recruiters = (data ?? []) as any[];
    }
  } else {
    const { data } = await admin.from("profiles").select("id, full_name").eq("role", "recruiter").eq("is_active", true);
    recruiters = (data ?? []) as any[];
  }

  let divisionName: string | null = null;
  if (divisionId) {
    const { data: d } = await admin.from("divisions").select("name").eq("id", divisionId).maybeSingle();
    divisionName = (d as { name?: string } | null)?.name ?? null;
  }

  const recruiterStats = recruiters.map((r) => ({ id: r.id, name: r.full_name }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Recruiter performance</h1>
        <p className="text-sm text-muted">{divisionName ? `${divisionName} domain` : "All domains"} · submissions, closures, conversion and pipeline by recruiter.</p>
      </div>
      <RecruiterPerformance recruiterStats={recruiterStats} divisionId={divisionId} today={istDateStr()} />
    </div>
  );
}
