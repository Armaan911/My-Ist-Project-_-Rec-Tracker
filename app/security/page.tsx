import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import NavBar from "@/components/NavBar";
import TwoFactorSetup from "@/components/TwoFactorSetup";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return (
    <div>
      <NavBar name={profile.full_name} role={profile.role} userId={profile.id} avatarUrl={(profile as any).avatar_url ?? null} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Security</h1>
        <TwoFactorSetup />
      </main>
    </div>
  );
}
