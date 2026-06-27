"use client";

import { useEffect, useState } from "react";
import { markBadgesSeen } from "@/app/badges/actions";

type NewBadge = { id: string; name: string; icon: string | null; color: string | null };

export default function BadgeCelebration({ newBadges }: { newBadges: NewBadge[] }) {
  const [show, setShow] = useState(newBadges.length > 0);

  useEffect(() => {
    if (newBadges.length === 0) return;
    markBadgesSeen(); // record that we've shown these
    const t = setTimeout(() => setShow(false), 7000);
    return () => clearTimeout(t);
  }, [newBadges.length]);

  if (!show || newBadges.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 animate-[slideIn_0.3s_ease-out]">
      <style>{`@keyframes slideIn{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes pop{0%{transform:scale(.6)}60%{transform:scale(1.15)}100%{transform:scale(1)}}`}</style>
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-pop">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-bold">🎉 Badge unlocked!</p>
          <button onClick={() => setShow(false)} className="text-muted hover:text-ink">✕</button>
        </div>
        <ul className="space-y-2">
          {newBadges.map((b) => (
            <li key={b.id} className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full text-lg"
                    style={{ backgroundColor: (b.color ?? "#6366f1") + "33", animation: "pop .4s ease-out" }}>
                {b.icon ?? "🏅"}
              </span>
              <span className="text-sm font-medium">{b.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
