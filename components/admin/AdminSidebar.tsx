"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Briefcase, CheckSquare, SlidersHorizontal, ScrollText, Award, Contact, Gauge, Gift } from "lucide-react";
import PendingApprovalsBadge from "@/components/PendingApprovalsBadge";

const items: [string, string, any][] = [
  ["/admin", "Overview", LayoutDashboard],
  ["/admin/accounts", "People", Users],
  ["/admin/recruiters", "Recruiters", Contact],
  ["/admin/requirements", "Requirements", Briefcase],
  ["/admin/metrics", "Daily metrics", Gauge],
  ["/admin/approvals", "Approvals", CheckSquare],
  ["/admin/rewards", "Rewards", Gift],
  ["/admin/badges", "Badges", Award],
  ["/admin/config", "Configuration", SlidersHorizontal],
  ["/admin/audit", "Audit log", ScrollText],
];

export default function AdminSidebar() {
  const path = usePathname();
  return (
    <nav className="space-y-1">
      {items.map(([href, label, Icon]) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
        return (
          <Link key={href} href={href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-brand-50 font-medium text-brand-700" : "text-muted hover:bg-canvas hover:text-ink"}`}>
            <Icon size={16} /> <span>{label}</span>
            {href === "/admin/approvals" && <PendingApprovalsBadge className="ml-auto" />}
            {href === "/admin/rewards" && <PendingApprovalsBadge className="ml-auto" endpoint="/api/rewards/pending-count" />}
          </Link>
        );
      })}
    </nav>
  );
}
