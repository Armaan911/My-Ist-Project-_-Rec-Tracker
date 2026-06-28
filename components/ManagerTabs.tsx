"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Briefcase, Contact, ClipboardCheck, Gift, Wallet, Bot } from "lucide-react";
import PendingApprovalsBadge from "@/components/PendingApprovalsBadge";

// Tab suffixes appended to a basePath so the same tabs work under /manager
// (managers) and /admin/teams (admins).
const TABS: [string, string, any][] = [
  ["", "Dashboard", BarChart3],
  ["/recruiters", "Recruiters", Contact],
  ["/ai-contributors", "AI Contributors", Bot],
  ["/requirements", "Requirements & allocation", Briefcase],
  ["/approvals", "Approvals", ClipboardCheck],
  ["/rewards", "Rewards", Gift],
];

export default function ManagerTabs({ basePath = "/manager" }: { basePath?: string }) {
  const path = usePathname();
  // Revenue (profit) is for managers + admins; it lives under each role's team base.
  const tabs: [string, string, any][] = [...TABS, ["/revenue", "Revenue", Wallet]];
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map(([suffix, label, Icon]) => {
        const href = `${basePath}${suffix}`;
        const active = suffix === "" ? path === basePath : path.startsWith(href);
        return (
          <Link key={href} href={href}
            className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${active ? "border-brand-600 font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            <Icon size={15} /> {label}
            {suffix === "/approvals" && <PendingApprovalsBadge />}
            {suffix === "/rewards" && <PendingApprovalsBadge endpoint="/api/rewards/pending-count" />}
          </Link>
        );
      })}
    </div>
  );
}
