"use client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { usePaged, Pager } from "@/components/Pager";

type Row = { contributor: string; jobRole: string; division: string; submitted: number; approved: number; internal: number; client: number };

export default function AiContributors({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [contributor, setContributor] = useState("all");
  const [division, setDivision] = useState("all");

  const contributors = useMemo(() => [...new Set(rows.map((r) => r.contributor))].sort(), [rows]);
  const divisions = useMemo(() => [...new Set(rows.map((r) => r.division))].sort(), [rows]);

  const filtered = useMemo(() => rows.filter((r) =>
    (contributor === "all" || r.contributor === contributor) &&
    (division === "all" || r.division === division) &&
    (q.trim() === "" || r.contributor.toLowerCase().includes(q.toLowerCase()) || r.jobRole.toLowerCase().includes(q.toLowerCase()))
  ), [rows, q, contributor, division]);
  const pg = usePaged(filtered, 20);

  const sum = filtered.reduce((a, r) => ({ submitted: a.submitted + r.submitted, approved: a.approved + r.approved, internal: a.internal + r.internal, client: a.client + r.client }), { submitted: 0, approved: 0, internal: 0, client: 0 });
  const uniqueContribs = new Set(filtered.map((r) => r.contributor)).size;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">AI contributors</h1>
        <p className="text-sm text-muted">How AI-team members' sourced candidates are performing, by job role.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <SummaryCard label="Contributors" value={uniqueContribs} />
        <SummaryCard label="Profiles submitted" value={sum.submitted} />
        <SummaryCard label="Approved" value={sum.approved} />
        <SummaryCard label="Internal subs" value={sum.internal} />
        <SummaryCard label="Client subs" value={sum.client} tone="success" />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contributor or job role…" className="h-9 w-56 rounded-lg border border-line bg-surface px-3 text-sm" />
          <select value={contributor} onChange={(e) => setContributor(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm"><option value="all">All contributors</option>{contributors.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select value={division} onChange={(e) => setDivision(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm"><option value="all">All divisions</option>{divisions.map((d) => <option key={d} value={d}>{d}</option>)}</select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted"><tr>
              <th className="py-2 pr-3 font-medium">Contributor</th><th className="pr-3 font-medium">Job role</th><th className="pr-3 font-medium">Division</th>
              <th className="pr-3 text-right font-medium">Submitted</th><th className="pr-3 text-right font-medium">Approved</th><th className="pr-3 text-right font-medium">Internal</th><th className="text-right font-medium">Client</th>
            </tr></thead>
            <tbody>
              {pg.slice.map((r, i) => (
                <tr key={i} className="border-t border-line/60">
                  <td className="py-2 pr-3 font-medium">{r.contributor}</td>
                  <td className="pr-3 text-muted">{r.jobRole}</td>
                  <td className="pr-3 text-muted">{r.division}</td>
                  <td className="pr-3 text-right">{r.submitted}</td>
                  <td className="pr-3 text-right">{r.approved}</td>
                  <td className="pr-3 text-right">{r.internal}</td>
                  <td className="text-right font-semibold">{r.client}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">No contributors match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={pg.page} pageCount={pg.pageCount} setPage={pg.setPage} total={pg.total} pageSize={pg.pageSize} />
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "success" }) {
  return <div className="rounded-2xl border border-line bg-surface p-4 elevate"><div className={`text-2xl font-bold ${tone === "success" ? "text-success-600" : "text-ink"}`}>{value}</div><div className="text-xs uppercase tracking-wide text-muted">{label}</div></div>;
}
