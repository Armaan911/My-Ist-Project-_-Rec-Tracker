import ManagerDashboard from "@/components/ManagerDashboard";
import { buildTeamDashboard } from "@/lib/teamView";

export const dynamic = "force-dynamic";

export default async function ManagerPage() {
  // Managers oversee every division — data read via service-role (role-gated by the manager layout).
  const { data, verified, today } = await buildTeamDashboard();
  return <ManagerDashboard data={data} verified={verified} today={today} />;
}
