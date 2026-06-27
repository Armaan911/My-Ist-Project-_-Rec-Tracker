"use client";
import { useState } from "react";
import { Card } from "@/components/ui";
import type { TeamPerf, Pace, MonthCell } from "@/lib/performance";
import { monthShort } from "@/lib/dates";

const monthLabel = (mk: string) => monthShort(mk);

function PaceBadge({ pace }: { pace: Pace }) {
  if (pace === "none") return <span className="text-xs text-muted">—</span>;
  const map = { ahead: ["bg-success-50", "text-success-600", "▲ ahead"], on: ["bg-brand-50", "text-brand-700", "● on track"], behind: ["bg-warning-50", "text-warning-600", "▼ behind"] } as const;
  const [bg, fg, txt] = map[pace];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${bg} ${fg}`}>{txt}</span>;
}

function attColor(pct: number | null) {
  if (pct == null) return { background: "transparent", color: "#9a9aa6" };
  const p = Math.min(120, pct);
  if (p >= 100) return { background: "#0E9F6E", color: "#fff" };
  if (p >= 75) return { background: `rgba(91,91,214,${0.25 + (p - 75) / 100})`, color: p >= 90 ? "#fff" : "#17171F" };
  if (p >= 50) return { background: "#FBF2E1", color: "#B7791F" };
  return { background: "#FDECEC", color: "#C53030" };
}

export default function PerformanceTracking({ perf }: { perf: TeamPerf }) {
  const [metric, setMetric] = useState<"subs" | "closures">("subs");
  const r = perf.recruiters;
  if (r.length === 0) return null;
  const months = r[0]?.scorecard.map((c) => c.month) ?? [];

  return (
    <div className="space-y-5">
      {/* pacing + ranking + benchmarking + efficiency + streaks */}
      <Card>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Performance — this month</h2>
          <span className="text-xs text-muted">Score = subs×{perf.weights.submissions} + closures×{perf.weights.closures} + active days×{perf.weights.active_days}</span>
        </div>
        <p className="mb-3 text-sm text-muted">Pace projects month-end from the pace so far. Team median: {perf.subMedian} subs · {perf.clMedian} closures.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2">#</th><th>Recruiter</th>
                <th className="text-right">Submissions</th><th>Pace</th>
                <th className="text-right">Closures</th><th>Pace</th>
                <th className="text-right">Active</th><th className="text-right">Streak</th>
                <th className="text-right">Subs/100</th><th className="text-right">Cls/100</th>
                <th className="text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {r.map((x) => (
                <tr key={x.id} className="border-t border-line">
                  <td className="py-2 font-semibold text-muted">{x.rank}</td>
                  <td className="font-medium">{x.name}</td>
                  <td className="text-right tabular">
                    <span className={x.subVsMedian === "above" ? "text-success-600" : x.subVsMedian === "below" ? "text-warning-600" : ""}>{x.pacing.subActual}</span>
                    <span className="text-muted">/{x.pacing.subTarget ?? "—"}</span>
                    <div className="text-[11px] text-muted">proj {x.pacing.subProjected}</div>
                  </td>
                  <td><PaceBadge pace={x.pacing.subPace} /></td>
                  <td className="text-right tabular">
                    <span className={x.clVsMedian === "above" ? "text-success-600" : x.clVsMedian === "below" ? "text-warning-600" : ""}>{x.pacing.clActual}</span>
                    <span className="text-muted">/{x.pacing.clTarget ?? "—"}</span>
                    <div className="text-[11px] text-muted">proj {x.pacing.clProjected}</div>
                  </td>
                  <td><PaceBadge pace={x.pacing.clPace} /></td>
                  <td className="text-right tabular">{x.activeDays}</td>
                  <td className="text-right tabular">{x.streak > 0 ? `🔥 ${x.streak}` : "—"}</td>
                  <td className="text-right tabular text-muted">{x.subsPer100 ?? "—"}</td>
                  <td className="text-right tabular text-muted">{x.closuresPer100 ?? "—"}</td>
                  <td className="text-right font-semibold tabular">{x.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* attainment scorecard heatmap */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Attainment scorecard</h2>
          <div className="flex rounded-lg border border-line p-0.5 text-sm">
            <button onClick={() => setMetric("subs")} className={`rounded-md px-3 py-1 ${metric === "subs" ? "bg-ink text-white" : "text-muted"}`}>Submissions</button>
            <button onClick={() => setMetric("closures")} className={`rounded-md px-3 py-1 ${metric === "closures" ? "bg-ink text-white" : "text-muted"}`}>Closures</button>
          </div>
        </div>
        <p className="mb-3 text-sm text-muted">Each cell is attainment vs that month&apos;s target (actual / target). Green ≥ 100%.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="text-xs uppercase text-muted"><tr><th className="py-2">Recruiter</th>{months.map((m) => <th key={m} className="px-1 text-center">{monthLabel(m)}</th>)}</tr></thead>
            <tbody>
              {r.map((x) => (
                <tr key={x.id} className="border-t border-line">
                  <td className="py-2 font-medium">{x.name}</td>
                  {x.scorecard.map((c: MonthCell) => {
                    const pct = metric === "subs" ? c.subPct : c.clPct;
                    const actual = metric === "subs" ? c.subActual : c.clActual;
                    const target = metric === "subs" ? c.subTarget : c.clTarget;
                    return (
                      <td key={c.month} className="px-1 py-1 text-center">
                        <div className="mx-auto flex h-11 w-14 flex-col items-center justify-center rounded-lg text-xs font-semibold" style={attColor(pct)} title={`${actual} of ${target ?? "no target"}`}>
                          <span>{pct == null ? "—" : pct + "%"}</span>
                          <span className="text-[10px] font-normal opacity-80">{actual}/{target ?? "–"}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* time-to KPIs + stage dwell */}
        <Card>
          <h2 className="mb-1 text-lg font-semibold">Speed</h2>
          <p className="mb-3 text-sm text-muted">How fast candidates move. Lower is better.</p>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted"><tr><th className="py-2">Recruiter</th><th className="text-right">To 1st submission</th><th className="text-right">To closure</th></tr></thead>
            <tbody>
              {r.map((x) => (
                <tr key={x.id} className="border-t border-line">
                  <td className="py-2 font-medium">{x.name}</td>
                  <td className="text-right tabular">{x.timeToFirstSub != null ? `${x.timeToFirstSub}d` : "—"}</td>
                  <td className="text-right tabular">{x.timeToClosure != null ? `${x.timeToClosure}d` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {perf.stageDwell.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-2 text-xs font-semibold uppercase text-muted">Avg days a candidate sits in each stage</div>
              <div className="space-y-1.5">
                {perf.stageDwell.map((s) => (
                  <div key={s.stage} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-sm">{s.stage}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, (s.avgDays / Math.max(1, perf.stageDwell[0].avgDays)) * 100)}%` }} /></div>
                    <span className="w-12 shrink-0 text-right text-sm tabular">{s.avgDays}d</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* conversion trend */}
        <Card>
          <h2 className="mb-1 text-lg font-semibold">Conversion trend</h2>
          <p className="mb-3 text-sm text-muted">Of each month&apos;s submissions, the share that reached each stage.</p>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted"><tr><th className="py-2">Month</th><th className="text-right">Subs</th><th className="text-right">→Client</th><th className="text-right">→Interview</th><th className="text-right">→Closure</th></tr></thead>
            <tbody>
              {perf.convTrend.map((c) => (
                <tr key={c.month} className="border-t border-line">
                  <td className="py-2 font-medium">{monthLabel(c.month)}</td>
                  <td className="text-right tabular">{c.submitted}</td>
                  <td className="text-right tabular text-muted">{c.clientPct}%</td>
                  <td className="text-right tabular text-muted">{c.interviewPct}%</td>
                  <td className="text-right font-semibold tabular text-brand-700">{c.closurePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
