"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { CalendarRange } from "lucide-react";
import PieBreakdown from "@/components/charts/PieBreakdown";
import { analyticsRange } from "@/app/manager/perf-actions";

type Analytics = {
  stageLabels: string[];
  pivot: { name: string; cells: number[]; total: number }[];
  teamEffort: { label: string; color: string; value: number }[];
  reqStatusBreakdown: { name: string; value: number }[];
  byClient: { name: string; count: number }[];
};

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm text-muted">{children}</p>;
}

// Plain-language analytics for managers who don't live in spreadsheets.
// A single From–To control filters all four sections for the chosen window.
export default function DetailedAnalytics({ analytics, divisionId = null, today }: { analytics?: Analytics; divisionId?: string | null; today: string }) {
  const monthStart = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<Analytics | undefined>(analytics);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!from || !to) return;
    let alive = true;
    setBusy(true);
    analyticsRange(from, to, divisionId).then((res) => {
      if (!alive) return;
      if (res.ok) setData(res.data);
      setBusy(false);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, divisionId]);

  if (!data) return null;
  const { stageLabels, pivot, teamEffort, reqStatusBreakdown, byClient } = data;

  const effortSteps = teamEffort;
  const maxEffort = Math.max(1, ...effortSteps.map((s) => s.value));
  const colMax = stageLabels.map((_, c) => Math.max(1, ...pivot.map((r) => r.cells[c] ?? 0)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-muted">
          <CalendarRange size={16} className="text-brand-700" /> Detailed analytics
          {busy && <span className="text-xs font-normal">· loading…</span>}
        </h2>
        <span className="flex items-center gap-1.5">
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" title="From" />
          <span className="text-xs text-muted">to</span>
          <input type="date" value={to} min={from || undefined} max={today} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" title="To" />
        </span>
      </div>

      {/* Team daily-effort funnel */}
      <Card>
        <h2 className="text-lg font-semibold">Team effort — from first contact to interview</h2>
        <Caption>This is the legwork your team logged in their daily updates. Each bar is the team total for that step. Big drops between two steps show where candidates fall out of the process.</Caption>
        <div className="space-y-2">
          {effortSteps.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-52 shrink-0 text-sm font-medium">{s.label}</div>
              <div className="h-7 flex-1 rounded-md bg-canvas">
                <div className="flex h-7 items-center justify-end rounded-md px-2 text-xs font-medium text-white" style={{ width: `${Math.max(6, (s.value / maxEffort) * 100)}%`, background: s.color }}>
                  {s.value}
                </div>
              </div>
            </div>
          ))}
          {effortSteps.every((s) => s.value === 0) && <p className="py-2 text-sm text-muted">No daily activity logged in this range.</p>}
        </div>
      </Card>

      {/* Recruiter x stage pivot */}
      <Card>
        <h2 className="text-lg font-semibold">Who has candidates at which stage</h2>
        <Caption>Every active candidate, counted by the recruiter handling them and the stage they're sitting at right now. Darker cells mean more candidates. Read a row to see one recruiter's whole pipeline; read a column to see how many candidates the whole team has at that stage.</Caption>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="pb-2 pr-3 font-medium">Recruiter</th>
                {stageLabels.map((l) => <th key={l} className="px-2 pb-2 text-center font-medium">{l}</th>)}
                <th className="px-2 pb-2 text-center font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {pivot.map((r) => (
                <tr key={r.name} className="border-t border-line">
                  <td className="py-2 pr-3 font-medium">{r.name}</td>
                  {r.cells.map((n, c) => {
                    const intensity = n === 0 ? 0 : 0.15 + 0.85 * (n / colMax[c]);
                    return (
                      <td key={c} className="px-2 py-2 text-center">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium"
                          style={{ backgroundColor: n === 0 ? "transparent" : `rgba(79,70,229,${intensity})`, color: intensity > 0.5 ? "white" : "inherit" }}>
                          {n || ""}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center font-semibold">{r.total}</td>
                </tr>
              ))}
              {pivot.length === 0 && <tr><td colSpan={stageLabels.length + 2} className="py-6 text-center text-sm text-muted">No candidates in the pipeline yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Requirement status breakdown */}
        <Card>
          <h2 className="text-lg font-semibold">Requirements by status</h2>
          <Caption>How your open roles split across statuses — how many are actively open versus on hold, filled or closed.</Caption>
          {reqStatusBreakdown.length ? <PieBreakdown data={reqStatusBreakdown} /> : <p className="py-2 text-sm text-muted">No requirements yet.</p>}
        </Card>

        {/* Per-client requirement counts */}
        <Card>
          <h2 className="text-lg font-semibold">Requirements by client</h2>
          <Caption>Which clients you're carrying the most open roles for. Useful for spotting where demand is concentrated.</Caption>
          <div className="space-y-2">
            {byClient.map((c) => {
              const max = Math.max(1, ...byClient.map((x) => x.count));
              return (
                <div key={c.name} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 truncate text-sm" title={c.name}>{c.name}</div>
                  <div className="h-6 flex-1 rounded-md bg-canvas">
                    <div className="flex h-6 items-center justify-end rounded-md bg-brand-600 px-2 text-xs font-medium text-white" style={{ width: `${Math.max(8, (c.count / max) * 100)}%` }}>{c.count}</div>
                  </div>
                </div>
              );
            })}
            {byClient.length === 0 && <p className="py-2 text-sm text-muted">No requirements yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
