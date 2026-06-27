"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { CalendarRange } from "lucide-react";
import type { TeamPerf, MonthCell } from "@/lib/performance";
import { monthShort } from "@/lib/dates";
import { perfRange } from "@/app/manager/perf-actions";

const monthLabel = (mk: string) => monthShort(mk);

type Vs = "above" | "below" | "even";
type RangeRow = {
  id: string; name: string; subs: number; closures: number; activeDays: number;
  subsPer100: number | null; closuresPer100: number | null; score: number; rank: number;
  subVsMedian: Vs; clVsMedian: Vs; timeToFirstSub: number | null; timeToClosure: number | null;
};
type RangePerf = {
  recruiters: RangeRow[]; subMedian: number; clMedian: number;
  stageDwell: { stage: string; avgDays: number; n: number }[];
  weights: { submissions: number; closures: number; active_days: number };
};

function attColor(pct: number | null) {
  if (pct == null) return { background: "transparent", color: "#9a9aa6" };
  const p = Math.min(120, pct);
  if (p >= 100) return { background: "#0E9F6E", color: "#fff" };
  if (p >= 75) return { background: `rgba(91,91,214,${0.25 + (p - 75) / 100})`, color: p >= 90 ? "#fff" : "#17171F" };
  if (p >= 50) return { background: "#FBF2E1", color: "#B7791F" };
  return { background: "#FDECEC", color: "#C53030" };
}

// From–To control (shared by Performance + Speed — both reflect the same range).
function RangeControl({ from, to, today, setFrom, setTo }: { from: string; to: string; today: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  return (
    <span className="flex items-center gap-1.5">
      <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" title="From" />
      <span className="text-xs text-muted">to</span>
      <input type="date" value={to} min={from || undefined} max={today} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" title="To" />
    </span>
  );
}

export default function PerformanceTracking({ perf, today }: { perf: TeamPerf; today: string }) {
  const [metric, setMetric] = useState<"subs" | "closures">("subs");
  const r = perf.recruiters;
  if (r.length === 0) return null;
  const months = r[0]?.scorecard.map((c) => c.month) ?? [];

  // Performance + Speed are date-range driven. Seed with this-month values already
  // computed in `perf` so there's no flash; refetch when the range changes.
  const monthStart = today.slice(0, 8) + "01";
  const initial: RangePerf = {
    recruiters: r.map((x) => ({
      id: x.id, name: x.name, subs: x.pacing.subActual, closures: x.pacing.clActual, activeDays: x.activeDays,
      subsPer100: x.subsPer100, closuresPer100: x.closuresPer100, score: x.score, rank: x.rank,
      subVsMedian: x.subVsMedian, clVsMedian: x.clVsMedian, timeToFirstSub: x.timeToFirstSub, timeToClosure: x.timeToClosure,
    })),
    subMedian: perf.subMedian, clMedian: perf.clMedian, stageDwell: perf.stageDwell, weights: perf.weights,
  };
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [range, setRange] = useState<RangePerf>(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!from || !to) return;
    let alive = true;
    setBusy(true);
    perfRange(from, to).then((res) => {
      if (!alive) return;
      if (res.ok) setRange(res.data as RangePerf);
      setBusy(false);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const rr = range.recruiters;

  return (
    <div className="space-y-5">
      {/* Performance — actuals over the selected range */}
      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarRange size={18} className="text-brand-700" /> Performance
            {busy && <span className="text-xs font-normal text-muted">· loading…</span>}
          </h2>
          <RangeControl from={from} to={to} today={today} setFrom={setFrom} setTo={setTo} />
        </div>
        <p className="mb-3 text-sm text-muted">
          Actuals over the selected range. Score = subs×{range.weights.submissions} + closures×{range.weights.closures} + active days×{range.weights.active_days}. Team median: {range.subMedian} subs · {range.clMedian} closures.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2">#</th><th>Recruiter</th>
                <th className="text-right">Submissions</th>
                <th className="text-right">Closures</th>
                <th className="text-right">Active</th>
                <th className="text-right">Subs/100</th><th className="text-right">Cls/100</th>
                <th className="text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {rr.map((x) => (
                <tr key={x.id} className="border-t border-line">
                  <td className="py-2 font-semibold text-muted">{x.rank}</td>
                  <td className="font-medium">{x.name}</td>
                  <td className="text-right tabular"><span className={x.subVsMedian === "above" ? "text-success-600" : x.subVsMedian === "below" ? "text-warning-600" : ""}>{x.subs}</span></td>
                  <td className="text-right tabular"><span className={x.clVsMedian === "above" ? "text-success-600" : x.clVsMedian === "below" ? "text-warning-600" : ""}>{x.closures}</span></td>
                  <td className="text-right tabular">{x.activeDays}</td>
                  <td className="text-right tabular text-muted">{x.subsPer100 ?? "—"}</td>
                  <td className="text-right tabular text-muted">{x.closuresPer100 ?? "—"}</td>
                  <td className="text-right font-semibold tabular">{x.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* attainment scorecard heatmap — month-by-month (unchanged) */}
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
        {/* time-to KPIs + stage dwell — over the selected range */}
        <Card>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarRange size={16} className="text-brand-700" /> Speed</h2>
            <RangeControl from={from} to={to} today={today} setFrom={setFrom} setTo={setTo} />
          </div>
          <p className="mb-3 text-sm text-muted">How fast candidates move in the selected range. Lower is better.</p>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted"><tr><th className="py-2">Recruiter</th><th className="text-right">To 1st submission</th><th className="text-right">To closure</th></tr></thead>
            <tbody>
              {rr.map((x) => (
                <tr key={x.id} className="border-t border-line">
                  <td className="py-2 font-medium">{x.name}</td>
                  <td className="text-right tabular">{x.timeToFirstSub != null ? `${x.timeToFirstSub}d` : "—"}</td>
                  <td className="text-right tabular">{x.timeToClosure != null ? `${x.timeToClosure}d` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {range.stageDwell.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-2 text-xs font-semibold uppercase text-muted">Avg days a candidate sits in each stage</div>
              <div className="space-y-1.5">
                {range.stageDwell.map((s) => (
                  <div key={s.stage} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-sm">{s.stage}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, (s.avgDays / Math.max(1, range.stageDwell[0].avgDays)) * 100)}%` }} /></div>
                    <span className="w-12 shrink-0 text-right text-sm tabular">{s.avgDays}d</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* conversion trend — month-by-month (unchanged) */}
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
