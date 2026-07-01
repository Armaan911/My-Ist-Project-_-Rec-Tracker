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
        <div className="grid gap-8 md:grid-cols-[220px_1fr]">
          <aside className="md:sticky md:top-20 md:self-start">
            <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted">AI desk</div>
            <AiTabs />
          </aside>
          <section className="min-w-0">{children}</section>
        </div>
      </main>
    </div>
  );
}
