import { createClient } from "@/lib/supabase/server";
import RequirementsManager from "@/components/admin/RequirementsManager";
import * as actions from "./actions";

export const dynamic = "force-dynamic";

export default async function RequirementsPage() {
  const supabase = createClient();
  const [{ data: divisions }, { data: clients }, { data: recruiters }, { data: requirements }, { data: allocations }, { data: pd }] = await Promise.all([
    supabase.from("divisions").select("id, name").order("name"),
    supabase.from("clients").select("id, name, division_id").order("name"),
    supabase.from("profiles").select("id, full_name, division_id").eq("role", "recruiter").eq("is_active", true).order("full_name"),
    supabase.from("requirements").select("id, title, job_code, positions, priority, status, date_received, division_id, divisions(name), clients(name)").order("date_received", { ascending: false }).limit(100),
    supabase.from("allocations").select("id, requirement_id, recruiter_id, allocation_date, profiles:profiles!recruiter_id(full_name)"),
    supabase.from("profile_divisions").select("profile_id, division_id"),
  ]);

  // Build recruiter -> division_ids[] (union of profile_divisions + home division_id fallback)
  const divMap = new Map<string, string[]>();
  for (const row of (pd as any[]) ?? []) {
    const arr = divMap.get(row.profile_id) ?? [];
    if (!arr.includes(row.division_id)) arr.push(row.division_id);
    divMap.set(row.profile_id, arr);
  }
  const recruitersWithDivs = ((recruiters as any[]) ?? []).map((rc) => {
    const ids = divMap.get(rc.id) ?? [];
    if (rc.division_id && !ids.includes(rc.division_id)) ids.push(rc.division_id);
    return { id: rc.id, full_name: rc.full_name, division_ids: ids };
  });

  return <RequirementsManager divisions={divisions ?? []} clients={(clients as any) ?? []} recruiters={recruitersWithDivs} requirements={(requirements as any) ?? []} allocations={(allocations as any) ?? []} actions={actions} fixedDivision={null} />;
}
