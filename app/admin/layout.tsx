import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import NavBar from "@/components/NavBar";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  return (
    <div>
      <NavBar name={profile.full_name} role={profile.role} userId={profile.id} avatarUrl={(profile as any).avatar_url ?? null} />
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
