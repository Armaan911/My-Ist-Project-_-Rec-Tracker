"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Briefcase, Contact, ClipboardCheck, Gift, Wallet, Bot } from "lucide-react";
import PendingApprovalsBadge from "@/components/PendingApprovalsBadge";

// Left sub-rail for the Team area. Suffixes append to a basePath so the same rail works under
// /manager (managers) and /admin/teams (admins).
const TABS: [string, string, any][] = [
  ["", "Dashboard", BarChart3],
  ["/recruiters", "Recruiters", Contact],
  ["/ai-contributors", "AI Contributors", Bot],
  ["/requirements", "Requirements & allocation", Briefcase],
  ["/approvals", "Approvals", ClipboardCheck],
  ["/rewards", "Rewards", Gift],
  ["/revenue", "Revenue", Wallet],
];

export default function ManagerTabs({ basePath = "/manager" }: { basePath?: string }) {
  const path = usePathname();
  return (
    <nav className="space-y-1">
      {TABS.map(([suffix, label, Icon]) => {
        const href = `${basePath}${suffix}`;
        const active = suffix === "" ? path === basePath : path.startsWith(href);
        return (
          <Link key={href} href={href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-brand-50 font-medium text-brand-700" : "text-muted hover:bg-canvas hover:text-ink"}`}>
            <Icon size={16} /> <span>{label}</span>
            {suffix === "/approvals" && <PendingApprovalsBadge className="ml-auto" />}
            {suffix === "/rewards" && <PendingApprovalsBadge className="ml-auto" endpoint="/api/rewards/pending-count" />}
          </Link>
        );
      })}
    </nav>
  );
}
