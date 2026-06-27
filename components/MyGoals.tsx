import { Card } from "@/components/ui";
import type { Pacing, MonthCell, Pace } from "@/lib/performance";
import { monthShort } from "@/lib/dates";

const monthLabel = (mk: string) => monthShort(mk);
const paceText: Record<Pace, string> = { ahead: "Ahead of pace", on: "On track", behind: "Behind pace", none: "No target set" };
const paceCls: Record<Pace, string> = { ahead: "text-success-600", on: "text-brand-700", behind: "text-warning-600", none: "text-muted" };

function Ring({ actual, target, pace, label }: { actual: number; target: number | null; pace: Pace; label: string }) {
  const pct = target ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-16 w-16 place-items-center rounded-full" style={{ background: `conic-gradient(#068AD3 ${pct * 3.6}deg, #E9E9EE 0deg)` }}>
        <div className="grid h-12 w-12 place-items-center rounded-full bg-surface text-sm font-bold tabular">{actual}</div>
      </div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted">{target != null ? `${actual} of ${target}` : "no target"}</div>
        <div className={`text-xs font-medium ${paceCls[pace]}`}>{paceText[pace]}</div>
      </div>
    </div>
  );
}

export default function MyGoals({ pacing, streak, activeDays, scorecard }: { pacing: Pacing; streak: number; activeDays: number; scorecard: MonthCell[] }) {
  const noTargets = pacing.subTarget == null && pacing.clTarget == null;
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">My goals — this month</h2>
        <span className="text-xs text-muted">{pacing.daysLeft} day{pacing.daysLeft === 1 ? "" : "s"} left</span>
      </div>

      {noTargets ? (
        <p className="text-sm text-muted">No targets set for this month yet. Your manager or an admin can set them.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Ring actual={pacing.subActual} target={pacing.subTarget} pace={pacing.subPace} label="Submissions" />
          <Ring actual={pacing.clActual} target={pacing.clTarget} pace={pacing.clPace} label="Closures" />
        </div>
      )}

      {!noTargets && (
        <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-ink">
          At this pace you&apos;re projected to finish around <span className="font-semibold">{pacing.subProjected}</span> submissions
          {pacing.clTarget != null && <> and <span className="font-semibold">{pacing.clProjected}</span> closures</> } this month.
        </p>
      )}

      <div className="mt-4 flex items-center gap-4 border-t border-line pt-3 text-sm">
        <span>{streak > 0 ? <>🔥 <span className="font-semibold">{streak}-day</span> logging streak</> : "No active streak — log today to start one"}</span>
        <span className="text-muted">·</span>
        <span><span className="font-semibold">{activeDays}</span> active days this month</span>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold uppercase text-muted">Submission attainment — last 6 months</div>
        <div className="flex gap-1.5">
          {scorecard.map((c) => {
            const pct = c.subPct;
            const h = pct == null ? 4 : Math.max(6, Math.min(60, (pct / 100) * 50));
            const col = pct == null ? "#E9E9EE" : pct >= 100 ? "#0E9F6E" : pct >= 75 ? "#068AD3" : pct >= 50 ? "#F59E0B" : "#EF4444";
            return (
              <div key={c.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-[60px] w-full items-end"><div className="w-full rounded-t" style={{ height: h, background: col }} title={`${c.subActual}/${c.subTarget ?? "–"}`} /></div>
                <span className="text-[10px] text-muted">{monthLabel(c.month)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
