import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import NavBar from "@/components/NavBar";
import HrTabs from "@/components/hr/HrTabs";

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "hr" && profile.role !== "admin") redirect("/dashboard");

  return (
    <div>
      <NavBar name={profile.full_name} role={profile.role} userId={profile.id} avatarUrl={(profile as any).avatar_url ?? null} />
      <main className="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-7 py-8">
        <div className="grid gap-8 md:grid-cols-[220px_1fr]">
          <aside className="md:sticky md:top-20 md:self-start">
            <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted">HR</div>
            <HrTabs />
          </aside>
          <section className="min-w-0">{children}</section>
        </div>
      </main>
    </div>
  );
}
