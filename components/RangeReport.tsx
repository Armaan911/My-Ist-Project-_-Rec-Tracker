"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { CalendarRange } from "lucide-react";
import { addDays } from "@/lib/dates";
import { rangeReport } from "@/app/manager/perf-actions";
import { usePaged, Pager } from "@/components/Pager";

type Report = Awaited<ReturnType<typeof rangeReport>>;

// Date-range report for the detailed view: pick any start/end and get team totals,
// a per-recruiter breakdown, and the underlying submission + closure records.
export default function RangeReport({ divisionId = null, today }: { divisionId?: string | null; today: string }) {
  const monthStart = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<Extract<Report, { ok: true }> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!from || !to) { setErr("Pick a from and to date"); return; }
    setBusy(true); setErr(null);
    const res = await rangeReport(from, to, divisionId);
    if (res.ok) setData(res); else setErr(res.error);
    setBusy(false);
  }
  // Auto-run on first mount and whenever the division changes.
  useEffect(() => { run(); /* eslint-disable-next-line */ }, [divisionId]);

  function preset(f: string, t: string) { setFrom(f); setTo(t); }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarRange size={18} className="text-brand-700" /> Date-range report
          {busy && <span className="text-xs font-normal text-muted">· loading…</span>}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" />
          <span className="text-xs text-muted">to</span>
          <input type="date" value={to} min={from || undefined} max={today} onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" />
          <button onClick={run} disabled={busy}
            className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {busy ? "…" : "Run"}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {[
          ["Last 7 days", addDays(today, -6), today],
          ["Last 30 days", addDays(today, -29), today],
          ["This month", monthStart, today],
          ["This year", today.slice(0, 4) + "-01-01", today],
        ].map(([label, f, t]) => (
          <button key={label} onClick={() => preset(f, t)}
            className="rounded-full border border-line px-3 py-1 text-xs text-muted transition-colors hover:border-brand-300 hover:text-ink">
            {label}
          </button>
        ))}
      </div>

      {err && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{err}</p>}

      {data && !err && (
        <>
          <p className="mb-4 text-sm text-muted">
            Showing {data.range.from} to {data.range.to}.
          </p>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <Chip label="Submissions" value={data.totals.submissions} tone="brand" />
            <Chip label="Closures" value={data.totals.closures} tone="success" />
            <Chip label="Recruiters active" value={data.totals.activeRecruiters} />
          </div>

          <h3 className="mb-2 text-sm font-medium text-muted">Per recruiter</h3>
          {data.perRecruiter.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">No activity in this range.</p>
          ) : (
            <div className="mb-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr><th className="py-2 pr-3 font-medium">Recruiter</th><th className="py-2 pr-3 font-medium">Submissions</th><th className="py-2 pr-3 font-medium">Closures</th></tr>
                </thead>
                <tbody>
                  {data.perRecruiter.map((r, i) => (
                    <tr key={i} className="border-t border-line/60">
                      <td className="py-2 pr-3">{r.name}</td>
                      <td className="py-2 pr-3 font-semibold text-brand-700">{r.subs}</td>
                      <td className="py-2 pr-3 font-semibold text-success-600">{r.closures}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <RecordTable title="Submissions in range" head={["Candidate", "Recruiter", "Requirement", "Stage", "Date"]}
            rows={data.submissions.map((s) => [s.candidate, s.recruiter, s.requirement, s.status, s.date])}
            empty="No submissions in this range." />
          <div className="h-5" />
          <RecordTable title="Closures in range" head={["Candidate", "Recruiter", "Requirement", "Closed on"]}
            rows={data.closures.map((c) => [c.candidate, c.recruiter, c.requirement, c.date])}
            empty="No closures in this range." />
        </>
      )}
    </Card>
  );
}

function Chip({ label, value, tone }: { label: string; value: number; tone?: "brand" | "success" }) {
  const accent = tone === "brand" ? "text-brand-700" : tone === "success" ? "text-success-600" : "text-ink";
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

function RecordTable({ title, head, rows, empty }: { title: string; head: string[]; rows: React.ReactNode[][]; empty: string }) {
  const pg = usePaged(rows, 15);
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-muted">{title} <span className="text-xs">({rows.length})</span></h3>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">{empty}</p>
      ) : (
        <>
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted">
                <tr>{head.map((h, i) => <th key={i} className="py-2 pr-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {pg.slice.map((r, i) => (
                  <tr key={i} className="border-t border-line/60">
                    {r.map((c, j) => <td key={j} className="py-2 pr-3 align-top">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={pg.page} pageCount={pg.pageCount} setPage={pg.setPage} total={pg.total} pageSize={pg.pageSize} />
        </>
      )}
    </div>
  );
}
