"use client";
import { Card } from "@/components/ui";
import PieBreakdown from "@/components/charts/PieBreakdown";

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
export default function DetailedAnalytics({ analytics }: { analytics?: Analytics }) {
  if (!analytics) return null;
  const { stageLabels, pivot, teamEffort, reqStatusBreakdown, byClient } = analytics;

  const effortSteps = teamEffort;
  const maxEffort = Math.max(1, ...effortSteps.map((s) => s.value));

  const colMax = stageLabels.map((_, c) => Math.max(1, ...pivot.map((r) => r.cells[c] ?? 0)));

  return (
    <div className="space-y-6">
      {/* Team daily-effort funnel */}
      <Card>
        <h2 className="text-lg font-semibold">Team effort this month — from first contact to interview</h2>
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
          {effortSteps.every((s) => s.value === 0) && <p className="py-2 text-sm text-muted">No daily activity logged yet this month.</p>}
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
