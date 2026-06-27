"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Gift } from "lucide-react";

const TABS: [string, string, any][] = [
  ["/ai", "AI desk", Bot],
  ["/ai/rewards", "Rewards", Gift],
];

export default function AiTabs() {
  const path = usePathname();
  return (
    <div className="mb-6 flex gap-1 border-b border-line">
      {TABS.map(([href, label, Icon]) => {
        const active = href === "/ai" ? path === "/ai" : path.startsWith(href);
        return (
          <Link key={href} href={href}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${active ? "border-brand-600 font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            <Icon size={15} /> {label}
          </Link>
        );
      })}
    </div>
  );
}
