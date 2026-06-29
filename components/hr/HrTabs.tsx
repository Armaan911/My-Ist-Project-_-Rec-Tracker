"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, History, BarChart3, Wallet } from "lucide-react";
import PendingApprovalsBadge from "@/components/PendingApprovalsBadge";

const tabs: [string, string, any][] = [
  ["/hr", "My Plate", ClipboardList],
  ["/hr/history", "History", History],
  ["/hr/analytics", "Analytics", BarChart3],
  ["/hr/revenue", "Revenue", Wallet],
];

export default function HrTabs() {
  const path = usePathname();
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map(([href, label, Icon]) => {
        const active = href === "/hr" ? path === "/hr" : path.startsWith(href);
        return (
          <Link key={href} href={href}
            className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${active ? "border-brand-600 font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            <Icon size={15} /> {label}
            {href === "/hr" && <PendingApprovalsBadge endpoint="/api/rewards/hr-pending-count" />}
          </Link>
        );
      })}
    </div>
  );
}
