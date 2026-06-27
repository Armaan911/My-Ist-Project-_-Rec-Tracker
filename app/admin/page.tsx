import ExportButton from "@/components/ExportButton";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { Users, Briefcase, CheckSquare, SlidersHorizontal, ScrollText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const supabase = createClient();
  const [{ count: users }, { count: openReqs }, { count: pending }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("requirements").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("change_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const Stat = ({ label, value, accent }: { label: string; value: any; accent?: boolean }) => (
    <Card className="p-5">
      <div className={`text-3xl font-bold ${accent && (value ?? 0) > 0 ? "text-warning-600" : ""}`}>{value ?? 0}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-muted">{label}</div>
    </Card>
  );

  const sections: [string, string, string, any][] = [
    ["/admin/accounts", "People", "Create recruiters, managers and admins; set divisions and targets.", Users],
    ["/admin/requirements", "Requirements", "Add clients and requirements, then allocate them to recruiters by day.", Briefcase],
    ["/admin/approvals", "Approvals", "Review and approve recruiters' edits to past-day entries.", CheckSquare],
    ["/admin/config", "Configuration", "Edit pipeline stages, medal tiers and the falling-behind rule.", SlidersHorizontal],
    ["/admin/audit", "Audit log", "Every account, requirement and config change, with who and when.", ScrollText],
  ];

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-sm text-muted">Manage people, work, and how the system behaves.</p>
        </div>
        <ExportButton label="Export performance" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Accounts" value={users} />
        <Stat label="Open requirements" value={openReqs} />
        <Stat label="Pending approvals" value={pending} accent />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sections.map(([href, title, desc, Icon]) => (
          <Link key={href} href={href}>
            <Card className="group h-full transition-colors hover:border-brand-600">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon size={18} /></span>
                <div>
                  <div className="font-semibold group-hover:text-brand-700">{title}</div>
                  <p className="mt-0.5 text-sm text-muted">{desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
