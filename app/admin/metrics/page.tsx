import { createClient } from "@/lib/supabase/server";
import MetricsManager from "@/components/admin/MetricsManager";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const supabase = createClient();
  const { data: metrics } = await supabase
    .from("daily_metrics")
    .select("id, key, label, hint, color, icon, input_style, soft_max, sort_order, is_active")
    .order("sort_order");
  return <MetricsManager metrics={(metrics as any) ?? []} />;
}
