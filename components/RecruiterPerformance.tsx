"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { Sparkles } from "lucide-react";
import { addDays } from "@/lib/dates";
import GroupedBar from "@/components/charts/GroupedBar";
import PieBreakdown from "@/components/charts/PieBreakdown";
import { generateRecruiterInsight } from "@/app/manager/ai-actions";
import { recruiterRangeFull } from "@/app/manager/perf-actions";
import { usePaged, Pager } from "@/components/Pager";

type RD = { subs: number; closures: number; total: number; reachedClient: number; reachedInterview: number; reachedClosure: number; withEmail: number; statusDist: Record<string, number> };

const PRESETS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
];
const EMPTY_RD: RD = { subs: 0, closures: 0, total: 0, reachedClient: 0, reachedInterview: 0, reachedClosure: 0, withEmail: 0, statusDist: {} };
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export default function RecruiterPerformance({ recruiterStats, divisionId = null, today }: { recruiterStats: any[]; overallPie?: any[]; divisionId?: string | null; today: string }) {
  const [sel, setSel] = useState("all");
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Record<string, RD>>({});
  const [busy, setBusy] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const range = useMemo<[string, string] | null>(() => {
    if (preset === "today") return [today, today];
    if (preset === "last7") return [addDays(today, -6), today];
    if (preset === "last30") return [addDays(today, -29), today];
    if (preset === "month") return [today.slice(0, 8) + "01", today];
    return from && to ? [from, to] : null;
  }, [preset, from, to, today]);
  const periodLabel = PRESETS.find((p) => p.value === preset)?.label.toLowerCase() ?? "this month";

  // The From–To inputs are always visible: for a preset they show its computed
  // window, and editing either one switches the selection to a custom range.
  const effFrom = preset === "custom" ? from : range?.[0] ?? "";
  const effTo = preset === "custom" ? to : range?.[1] ?? "";
  const editFrom = (v: string) => { if (preset !== "custom") { setFrom(v); setTo(effTo); setPreset("custom"); } else setFrom(v); };
  const editTo = (v: string) => { if (preset !== "custom") { setTo(v); setFrom(effFrom); setPreset("custom"); } else setTo(v); };

  useEffect(() => {
    if (!range) return;
    let alive = true; setBusy(true);
    recruiterRangeFull(range[0], range[1], divisionId).then((res) => {
      if (!alive) return;
      setData(res.ok ? (res.data as Record<string, RD>) : {});
      setBusy(false);
    });
    return () => { alive = false; };
  }, [range?.[0], range?.[1], divisionId]);

  const rd = (id: string): RD => data[id] ?? EMPTY_RD;
  const r = recruiterStats.find((x) => x.id === sel) ?? null;

  const overallPie = useMemo(() => {
    const m: Record<string, number> = {};
    for (const id of Object.keys(data)) for (const [k, v] of Object.entries(data[id].statusDist)) m[k] = (m[k] ?? 0) + (v as number);
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [data]);

  async function getInsight() {
    if (!r) return; setAiBusy(true); setInsight(null);
    const res = await generateRecruiterInsight(r.id); setInsight(res.text); setAiBusy(false);
  }

  const summary = (() => {
    if (sel === "all") {
      if (recruiterStats.length === 0) return "No recruiters in this view yet.";
      const totSub = recruiterStats.reduce((n, x) => n + rd(x.id).subs, 0);
      const totClo = recruiterStats.reduce((n, x) => n + rd(x.id).closures, 0);
      const top = [...recruiterStats].sort((a, b) => rd(b.id).closures - rd(a.id).closures || rd(b.id).subs - rd(a.id).subs)[0];
      return `${recruiterStats.length} recruiter${recruiterStats.length === 1 ? "" : "s"} logged ${totSub} submission${totSub === 1 ? "" : "s"} and ${totClo} closure${totClo === 1 ? "" : "s"} ${periodLabel}. ${top && (rd(top.id).subs || rd(top.id).closures) ? `${top.name} leads.` : ""}`;
    }
    if (!r) return "";
    const v = rd(r.id);
    return `${r.name} made ${v.subs} submissions and ${v.closures} closures ${periodLabel}. ${pct(v.reachedClosure, v.total)}% of those reach a closure; data quality ${pct(v.withEmail, v.total)}%.`;
  })();

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Recruiter performance {busy && <span className="text-xs font-normal text-muted">· loading…</span>}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" value={preset} onChange={(e) => setPreset(e.target.value)}>
            {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <span className="flex items-center gap-1.5">
            <input type="date" value={effFrom} max={effTo || undefined} onChange={(e) => editFrom(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" title="From" />
            <span className="text-xs text-muted">to</span>
            <input type="date" value={effTo} min={effFrom || undefined} max={today} onChange={(e) => editTo(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" title="To" />
          </span>
          <select className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" value={sel} onChange={(e) => { setSel(e.target.value); setInsight(null); }}>
            <option value="all">Overall (all recruiters)</option>
            {recruiterStats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
      </div>

      <p className="mb-3 rounded-lg bg-canvas px-3 py-2 text-sm text-ink">{summary}</p>

      {r && (
        <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium text-ink"><Sparkles size={15} className="text-brand-700" /> AI insight on {r.name}</span>
            <button onClick={getInsight} disabled={aiBusy} className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{aiBusy ? "Thinking…" : insight ? "Regenerate" : "Get insight"}</button>
          </div>
          {insight && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{insight}</p>}
        </div>
      )}

      {sel === "all" ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted">Submissions vs closures — {periodLabel}</h3>
              <GroupedBar data={recruiterStats.map((x) => ({ name: x.name, submissions: rd(x.id).subs, closures: rd(x.id).closures }))} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted">Pipeline distribution — {periodLabel}</h3>
              <PieBreakdown data={overallPie} />
            </div>
          </div>
          <OverallTable rows={recruiterStats} rd={rd} periodLabel={periodLabel} />
        </>
      ) : r ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Mini label={`Submissions · ${periodLabel}`} value={rd(r.id).subs} />
              <Mini label={`Closures · ${periodLabel}`} value={rd(r.id).closures} />
              <Mini label="→Closure %" value={`${pct(rd(r.id).reachedClosure, rd(r.id).total)}%`} sub={`of ${rd(r.id).total} subs`} />
              <Mini label="Data quality" value={`${pct(rd(r.id).withEmail, rd(r.id).total)}%`} sub="emails on file" />
            </div>
            <h3 className="mb-2 mt-5 text-sm font-medium text-muted">Conversion funnel — {periodLabel}</h3>
            <ConvBars rd={rd(r.id)} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted">Their pipeline by stage — {periodLabel}</h3>
            <PieBreakdown data={Object.entries(rd(r.id).statusDist).map(([name, value]) => ({ name, value }))} />
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function OverallTable({ rows, rd, periodLabel }: { rows: any[]; rd: (id: string) => RD; periodLabel: string }) {
  const pg = usePaged(rows, 20);
  if (rows.length === 0) return null;
  return (
    <>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted">
            <tr>
              <th className="py-2">Recruiter</th>
              <th className="text-right">Subs · {periodLabel}</th>
              <th className="text-right">Closures · {periodLabel}</th>
              <th className="text-right">→Closure %</th>
              <th className="text-right">Goal % (mo)</th>
              <th className="text-right">Quality %</th>
            </tr>
          </thead>
          <tbody>
            {pg.slice.map((r) => {
              const d = rd(r.id);
              return (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-2 font-medium">{r.name}</td>
                  <td className="text-right">{d.subs}</td>
                  <td className="text-right font-semibold">{d.closures}</td>
                  <td className="text-right">{pct(d.reachedClosure, d.total)}%</td>
                  <td className="text-right">{r.subTarget ? <span className={r.submissionsMonth >= r.subTarget ? "text-success-600" : "text-warning-600"}>{Math.round((r.submissionsMonth / r.subTarget) * 100)}%</span> : "—"}</td>
                  <td className="text-right">{pct(d.withEmail, d.total)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager page={pg.page} pageCount={pg.pageCount} setPage={pg.setPage} total={pg.total} pageSize={pg.pageSize} />
    </>
  );
}

function Mini({ label, value, sub }: { label: string; value: any; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function ConvBars({ rd }: { rd: RD }) {
  const stages = [
    { label: "Submitted", p: 100, n: rd.total },
    { label: "Reached client", p: pct(rd.reachedClient, rd.total), n: rd.reachedClient },
    { label: "Reached interview", p: pct(rd.reachedInterview, rd.total), n: rd.reachedInterview },
    { label: "Reached closure", p: pct(rd.reachedClosure, rd.total), n: rd.reachedClosure },
  ];
  return (
    <div className="space-y-2">
      {stages.map((s) => (
        <div key={s.label}>
          <div className="mb-0.5 flex justify-between text-xs text-muted"><span>{s.label}</span><span>{s.n} · {s.p}%</span></div>
          <div className="h-2 w-full rounded-full bg-line"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${s.p}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
