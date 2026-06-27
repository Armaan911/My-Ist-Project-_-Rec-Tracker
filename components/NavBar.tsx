"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LayoutGrid, BarChart3, Settings2, ShieldCheck, LogOut, Gift, Bot, BadgeCheck, Menu, X } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import NavUserMenu from "@/components/NavUserMenu";

// Hosted Podium logo first, committed local gif as fallback, then text mark.
const LOGO_SRCS = ["https://i.ibb.co/TjgLdLf/117092.gif", "/117092.gif"];

export default function NavBar({ name, role, userId, avatarUrl, isCoordinator }: { name: string; role: string; userId?: string; avatarUrl?: string | null; isCoordinator?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [logoStage, setLogoStage] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = role === "admin";
  const isMgr = role === "admin" || role === "manager";

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const links = [
    { href: "/dashboard", label: "My day", icon: LayoutGrid, show: role !== "hr" && role !== "admin" && role !== "ai_team" },
    { href: "/rewards", label: "Rewards", icon: Gift, show: role === "recruiter" },
    { href: "/verify", label: "Verify", icon: BadgeCheck, show: !!isCoordinator },
    { href: "/ai", label: "AI desk", icon: Bot, show: role === "ai_team" },
    // Admins get their own Teams area; managers stay on /manager.
    { href: isAdmin ? "/admin/teams" : "/manager", label: "Team", icon: BarChart3, show: isMgr },
    { href: "/hr", label: "Incentives", icon: Gift, show: role === "hr" || role === "admin" },
    { href: "/admin", label: "Admin", icon: Settings2, show: role === "admin" },
    { href: "/security", label: "Security", icon: ShieldCheck, show: true },
  ].filter((l) => l.show);

  // /admin/teams must not also light up the /admin (console) tab.
  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/admin") return pathname.startsWith("/admin") && !pathname.startsWith("/admin/teams");
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="h-0.5 w-full brand-mark opacity-90" />
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-3 sm:px-5 lg:px-7 py-3">
        <div className="flex items-center gap-3 sm:gap-5">
          <button onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" aria-expanded={menuOpen}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-ink hover:bg-canvas sm:hidden">
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5">
            {logoStage < LOGO_SRCS.length ? (
              <img src={LOGO_SRCS[logoStage]} alt="Podium" onError={() => setLogoStage((s) => s + 1)} className="h-14 w-auto max-w-[240px] object-contain mix-blend-multiply" />
            ) : (
              <>
                <span className="grid h-9 w-9 place-items-center rounded-xl brand-mark text-[15px] font-bold text-white shadow-[0_2px_8px_rgba(6,138,211,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]">P</span>
                <span className="font-display text-[15px] font-bold tracking-tight leading-none">Podium</span>
              </>
            )}
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link key={href} href={href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${active ? "bg-brand-50 text-brand-700 shadow-[inset_0_0_0_1px_rgba(91,91,214,0.18)]" : "text-muted hover:bg-canvas hover:text-ink"}`}>
                  <Icon size={15} className={active ? "text-brand-600" : ""} /> {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold leading-tight">{name}</div>
            <div className="text-[11px] uppercase tracking-wide leading-tight text-muted">{role}</div>
          </div>
          {userId && <NavUserMenu userId={userId} name={name} initialUrl={avatarUrl ?? null} />}
          <button onClick={signOut} title="Sign out"
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-danger-600/30 hover:bg-danger-50 hover:text-danger-600">
            <LogOut size={15} /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-line bg-surface px-3 py-2 sm:hidden">
          <div className="flex flex-col gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-canvas"}`}>
                  <Icon size={17} className={active ? "text-brand-600" : "text-muted"} /> {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
