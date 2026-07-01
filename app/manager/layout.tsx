import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import ManagerTabs from "@/components/ManagerTabs";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("full_name, role, avatar_url").eq("id", user.id).single();

  // Managers + admins only. Recruiters and HR have their own homes.
  if (!profile || profile.role === "recruiter" || profile.role === "hr") redirect("/dashboard");

  return (
    <div>
      <NavBar name={profile.full_name} role={profile.role} userId={user.id} avatarUrl={(profile as any).avatar_url ?? null} />
      <main className="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-7 py-8">
        <div className="grid gap-8 md:grid-cols-[220px_1fr]">
          <aside className="md:sticky md:top-20 md:self-start">
            <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted">Team</div>
            <ManagerTabs />
          </aside>
          <section className="min-w-0">{children}</section>
        </div>
      </main>
    </div>
  );
}
