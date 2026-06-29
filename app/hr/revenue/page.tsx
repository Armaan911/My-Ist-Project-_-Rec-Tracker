import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import RevenueTracker from "@/components/RevenueTracker";
import { loadClosureRevenue } from "@/lib/revenueData";

export const dynamic = "force-dynamic";

// HR manages the contract revenue too (monthly profit × duration per closure).
export default async function HrRevenuePage() {
  const me = await getProfile();
  if (!me) redirect("/login");
  if (me.role !== "hr" && me.role !== "admin") redirect("/dashboard");

  const closures = await loadClosureRevenue();
  return <RevenueTracker closures={closures} canEdit={me.role === "hr" || me.role === "admin"} />;
}
