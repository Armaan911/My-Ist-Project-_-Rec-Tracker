import { Card } from "@/components/ui";
import { medalFor, type Tier } from "@/lib/medals";

export default function MedalShowcase({ closuresAll, tiers }: { closuresAll: number; tiers: Tier[] }) {
  const sorted = [...tiers].sort((a, b) => a.min_closures - b.min_closures);
  const current = medalFor(closuresAll, tiers);
  const next = sorted.find((t) => t.min_closures > closuresAll) ?? null;
  const prev = current?.min_closures ?? 0;
  const pct = next ? Math.min(100, Math.round(((closuresAll - prev) / (next.min_closures - prev)) * 100)) : 100;

  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold">Your medals</h2>
      <div className="flex items-center gap-4">
        {current ? (
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium"
                style={{ backgroundColor: (current.color ?? "#ddd") + "55" }}>
            ● {current.name}
          </span>
        ) : (
          <span className="text-sm text-slate-500">No medal yet — land your first closure.</span>
        )}
        <span className="text-sm text-slate-500">{closuresAll} all-time closure{closuresAll === 1 ? "" : "s"}</span>
      </div>
      {next && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Next: {next.name}</span>
            <span>{next.min_closures - closuresAll} closure(s) to go</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-slate-800" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {sorted.map((t) => (
          <span key={t.name} className={`rounded px-2 py-0.5 text-xs ${closuresAll >= t.min_closures ? "" : "opacity-40"}`}
                style={{ backgroundColor: (t.color ?? "#ddd") + "55" }}>
            {t.name} · {t.min_closures}
          </span>
        ))}
      </div>
    </Card>
  );
}
