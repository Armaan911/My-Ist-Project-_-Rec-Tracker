import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import RequirementsManager from "@/components/admin/RequirementsManager";
import MessageComposer from "@/components/MessageComposer";
import * as actions from "./actions";

export const dynamic = "force-dynamic";

export default async function ManagerRequirementsPage() {
  const me = await getProfile();
  const isAdmin = me?.role === "admin";

  // Managers oversee ALL divisions here — read via the service-role client (page is role-gated by the manager layout).
  const admin = createAdminClient();
  const [{ data: divisions }, { data: clients }, { data: recruiters }, { data: requirements }, { data: allocations }, { data: pd }] = await Promise.all([
    admin.from("divisions").select("id, name").order("name"),
    admin.from("clients").select("id, name, division_id").order("name"),
    // Disambiguate the divisions embed: profiles links to divisions twice (direct division_id FK +
    // the profile_divisions join table), so a bare divisions(name) errors (PGRST201) and silently
    // returns no recruiters. Pin it to the direct FK.
    admin.from("profiles").select("id, full_name, division_id, divisions!profiles_division_id_fkey(name)").eq("role", "recruiter").eq("is_active", true).order("full_name"),
    admin.from("requirements").select("id, title, job_code, positions, priority, status, date_received, division_id, divisions(name), clients(name)").order("date_received", { ascending: false }).limit(200),
    admin.from("allocations").select("id, requirement_id, recruiter_id, allocation_date, profiles:profiles!recruiter_id(full_name)"),
    admin.from("profile_divisions").select("profile_id, division_id"),
  ]);

  const divMap = new Map<string, string[]>();
  for (const row of (pd as any[]) ?? []) {
    const arr = divMap.get(row.profile_id) ?? [];
    if (!arr.includes(row.division_id)) arr.push(row.division_id);
    divMap.set(row.profile_id, arr);
  }
  const recruitersWithDivs = ((recruiters as any[]) ?? []).map((rc) => {
    const ids = divMap.get(rc.id) ?? [];
    if (rc.division_id && !ids.includes(rc.division_id)) ids.push(rc.division_id);
    return { id: rc.id, full_name: rc.full_name, divisions: rc.divisions, division_ids: ids };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Requirements &amp; allocation</h1>
        <p className="text-sm text-muted">
          {isAdmin ? "Create requirements and allocate them to recruiters in the matching division." : "Allocate requirements to recruiters in the matching division. New requirements are created by admins."}
        </p>
      </div>

      <MessageComposer recruiters={(recruiters as any) ?? []} />

      <RequirementsManager
        divisions={divisions ?? []}
        clients={(clients as any) ?? []} recruiters={recruitersWithDivs}
        requirements={(requirements as any) ?? []} allocations={(allocations as any) ?? []}
        actions={actions} fixedDivision={null}
        canCreate={isAdmin} canDelete={isAdmin}
      />
    </div>
  );
}
