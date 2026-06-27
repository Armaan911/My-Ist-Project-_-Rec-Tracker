import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import NavBar from "@/components/NavBar";
import AiTabs from "@/components/ai/AiTabs";

export default async function AiLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  // AI desk is for the AI team only — admins go to their team dashboard.
  if (profile.role !== "ai_team") redirect("/dashboard");

  return (
    <div>
      <NavBar name={profile.full_name} role={profile.role} userId={profile.id} avatarUrl={(profile as any).avatar_url ?? null} />
      <main className="mx-auto max-w-[1600px] px-3 py-8 sm:px-5 lg:px-7">
        <AiTabs />
        {children}
      </main>
    </div>
  );
}
