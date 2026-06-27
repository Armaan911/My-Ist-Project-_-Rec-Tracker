"use client";

import { Card } from "@/components/ui";

export type BadgeView = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  earned: boolean;
  count: number;           // times awarded (repeatable)
  repeatable: boolean;
  progress: { current: number; target: number } | null;
};

export default function BadgesPanel({ badges }: { badges: BadgeView[] }) {
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Achievements</h2>
        <span className="text-xs text-muted">{earned.length}/{badges.length} unlocked</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {earned.map((b) => <BadgeTile key={b.id} b={b} />)}
        {locked.map((b) => <BadgeTile key={b.id} b={b} />)}
      </div>
      {badges.length === 0 && <p className="py-2 text-sm text-muted">No badges configured yet.</p>}
    </Card>
  );
}

function BadgeTile({ b }: { b: BadgeView }) {
  const color = b.color ?? "#6366f1";
  const pct = b.progress && b.progress.target > 0
    ? Math.min(100, Math.round((b.progress.current / b.progress.target) * 100))
    : 0;

  return (
    <div
      className={`group relative rounded-xl border p-3 text-center transition ${b.earned ? "border-line bg-surface" : "border-dashed border-line bg-canvas/40"}`}
    >
      {/* hover tooltip: what the badge means */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-48 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-left text-xs text-white shadow-pop group-hover:block">
        <div className="font-semibold">{b.icon ?? "🏅"} {b.name}</div>
        {b.description && <div className="mt-0.5 text-white/80">{b.description}</div>}
        <div className="mt-1 text-[10px] uppercase tracking-wide text-white/60">
          {b.earned ? (b.repeatable && b.count > 1 ? `Unlocked ×${b.count}` : "Unlocked") : b.progress && b.progress.target > 0 ? `Locked · ${b.progress.current}/${b.progress.target}` : "Locked"}
        </div>
      </div>

      {b.earned && b.repeatable && b.count > 1 && (
        <span className="absolute right-2 top-2 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">×{b.count}</span>
      )}
      <div
        className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full text-xl"
        style={{ backgroundColor: color + (b.earned ? "33" : "14"), filter: b.earned ? "none" : "grayscale(1)", opacity: b.earned ? 1 : 0.5 }}
      >
        {b.icon ?? "🏅"}
      </div>
      <div className={`text-xs font-semibold leading-tight ${b.earned ? "text-ink" : "text-muted"}`}>{b.name}</div>

      {/* explicit unlocked / locked status */}
      <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${b.earned ? "bg-success-50 text-success-600" : "bg-canvas text-muted"}`}>
        {b.earned ? "✓ Unlocked" : "🔒 Locked"}
      </div>

      {!b.earned && b.progress && b.progress.target > 0 && (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded-full bg-line">
            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
          <div className="mt-1 text-[10px] text-muted">{b.progress.current}/{b.progress.target}</div>
        </div>
      )}
    </div>
  );
}
