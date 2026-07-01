"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, History, BarChart3, Wallet, LineChart } from "lucide-react";
import PendingApprovalsBadge from "@/components/PendingApprovalsBadge";

const tabs: [string, string, any][] = [
  ["/hr", "My Plate", ClipboardList],
  ["/hr/history", "History", History],
  ["/hr/performance", "Performance", LineChart],
  ["/hr/analytics", "Analytics", BarChart3],
  ["/hr/revenue", "Revenue", Wallet],
];

export default function HrTabs() {
  const path = usePathname();
  return (
    <nav className="space-y-1">
      {tabs.map(([href, label, Icon]) => {
        const active = href === "/hr" ? path === "/hr" : path.startsWith(href);
        return (
          <Link key={href} href={href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-brand-50 font-medium text-brand-700" : "text-muted hover:bg-canvas hover:text-ink"}`}>
            <Icon size={16} /> <span>{label}</span>
            {href === "/hr" && <PendingApprovalsBadge className="ml-auto" endpoint="/api/rewards/hr-pending-count" />}
          </Link>
        );
      })}
    </nav>
  );
}
