import { createClient } from "@/lib/supabase/server";
import BadgesManager from "@/components/admin/BadgesManager";

export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  const supabase = createClient();
  const { data: badges } = await supabase
    .from("badges")
    .select("id, code, name, description, icon, color, rule, threshold, period, is_repeatable, is_active, sort_order")
    .order("sort_order");
  return <BadgesManager badges={(badges as any) ?? []} />;
}
