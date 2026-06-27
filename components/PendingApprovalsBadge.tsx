"use client";
import { useEffect, useState } from "react";

// Small red count pill for a nav item (Approvals / Rewards) — polls the pending count
// from `endpoint` (scoped server-side to what the user can act on). Hidden when zero.
export default function PendingApprovalsBadge({ className = "", endpoint = "/api/approvals/pending-count" }: { className?: string; endpoint?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(endpoint, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { count?: number };
        if (alive) setCount(d.count ?? 0);
      } catch { /* ignore */ }
    };
    void load();
    const id = setInterval(() => void load(), 30_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => { alive = false; clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [endpoint]);

  if (count <= 0) return null;
  return (
    <span className={`grid h-5 min-w-[20px] place-items-center rounded-full bg-danger-600 px-1.5 text-[11px] font-bold leading-none text-white ${className}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
