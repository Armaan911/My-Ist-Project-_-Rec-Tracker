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
    <nav className="space-y-1">
      {TABS.map(([href, label, Icon]) => {
        const active = href === "/ai" ? path === "/ai" : path.startsWith(href);
        return (
          <Link key={href} href={href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-brand-50 font-medium text-brand-700" : "text-muted hover:bg-canvas hover:text-ink"}`}>
            <Icon size={16} /> <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
