import { createClient } from "@/lib/supabase/server";
import AccountManager from "@/components/admin/AccountManager";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const supabase = createClient();
  const [{ data: divisions }, { data: profiles }, { data: pd }] = await Promise.all([
    supabase.from("divisions").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, email, role, division_id, monthly_submission_target, is_active, avatar_url, is_coordinator").order("full_name"),
    supabase.from("profile_divisions").select("profile_id, division_id"),
  ]);

  const divMap = new Map<string, string[]>();
  for (const row of (pd as any[]) ?? []) {
    const arr = divMap.get(row.profile_id) ?? [];
    if (!arr.includes(row.division_id)) arr.push(row.division_id);
    divMap.set(row.profile_id, arr);
  }
  const profilesWithDivs = ((profiles as any[]) ?? []).map((p) => {
    const ids = divMap.get(p.id) ?? [];
    if (p.division_id && !ids.includes(p.division_id)) ids.unshift(p.division_id);
    return { ...p, division_ids: ids };
  });

  return <AccountManager divisions={divisions ?? []} profiles={profilesWithDivs} />;
}
