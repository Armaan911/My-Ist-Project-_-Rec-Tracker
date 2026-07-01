import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import ManagerDashboard from "@/components/ManagerDashboard";
import { buildTeamDashboard } from "@/lib/teamView";

export const dynamic = "force-dynamic";

// HR Performance tab: the exact same team dashboard the manager/admin see.
export default async function HrPerformancePage() {
  const me = await getProfile();
  if (!me) redirect("/login");
  if (me.role !== "hr" && me.role !== "admin") redirect("/dashboard");

  const { data, verified, today } = await buildTeamDashboard();
  return <ManagerDashboard data={data} verified={verified} today={today} />;
}
