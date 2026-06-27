import { createClient } from "@/lib/supabase/server";
import ConfigManager from "@/components/admin/ConfigManager";
import HrEmailCard from "@/components/admin/HrEmailCard";
import AccountManagerEmailCard from "@/components/admin/AccountManagerEmailCard";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const supabase = createClient();
  const [{ data: statuses }, { data: tiers }, { data: setting }, { data: lbSetting }, { data: hrSetting }, { data: amSetting }] = await Promise.all([
    supabase.from("submission_statuses").select("id, code, label, sort_order, counts_as_closure, is_rejection, is_terminal, is_active").order("sort_order"),
    supabase.from("medal_tiers").select("id, name, min_closures, color"),
    supabase.from("app_settings").select("value").eq("key", "falling_behind").maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "leaderboard_weights").maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "hr_email").maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "account_manager_email").maybeSingle(),
  ]);
  const falling = (setting?.value as any) ?? { min_activity_days_per_week: 4, min_submissions_per_week: 5 };
  const weights = (lbSetting?.value as any) ?? { submissions: 1, closures: 5, active_days: 2 };
  const hrEmail = (hrSetting?.value as { email?: string } | null)?.email ?? "";
  const accountManagerEmail = (amSetting?.value as { email?: string } | null)?.email ?? "";
  return (
    <div className="space-y-6">
      <HrEmailCard initial={hrEmail} />
      <AccountManagerEmailCard initial={accountManagerEmail} />
      <ConfigManager statuses={statuses ?? []} tiers={tiers ?? []} falling={falling} weights={weights} />
    </div>
  );
}
