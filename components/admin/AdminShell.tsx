"use client";
import { usePathname } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ManagerTabs from "@/components/ManagerTabs";

// Admin chrome. The console sidebar shows everywhere except the /admin/teams area,
// which uses the manager tabs full-width so admins get the full team dashboard at a
// proper admin URL (instead of being sent to /manager).
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isTeams = path.startsWith("/admin/teams");

  if (isTeams) {
    return (
      <main className="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-7 py-8">
        <ManagerTabs basePath="/admin/teams" />
        {children}
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-7 py-8">
      <div className="grid gap-8 md:grid-cols-[210px_1fr]">
        <aside className="md:sticky md:top-20 md:self-start">
          <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted">Admin console</div>
          <AdminSidebar />
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
