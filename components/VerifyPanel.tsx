"use client";
import { useState } from "react";
import { Card } from "@/components/ui";
import { toast } from "@/components/uikit";
import { usePaged, Pager } from "@/components/Pager";
import { setSubmissionVerified, setDailyVerified } from "@/app/verify/actions";

type Sub = { id: string; candidate: string; recruiter: string; requirement: string; status: string; date: string; verified: boolean };
type Log = { id: string; recruiter: string; division: string; date: string; sourced: number; parsed: number; notes: string; verified: boolean };

export default function VerifyPanel({ submissions, logs }: { submissions: Sub[]; logs: Log[] }) {
  const [tab, setTab] = useState<"subs" | "logs">("subs");
  const [subs, setSubs] = useState(submissions);
  const [lg, setLg] = useState(logs);

  return (
    <Card>
      <div className="mb-4 flex w-fit items-center gap-1 rounded-lg border border-line p-0.5 text-sm">
        <button onClick={() => setTab("subs")} className={`rounded-md px-3 py-1 ${tab === "subs" ? "bg-brand-600 text-white" : "text-muted hover:text-ink"}`}>Submissions ({subs.filter((s) => !s.verified).length} pending)</button>
        <button onClick={() => setTab("logs")} className={`rounded-md px-3 py-1 ${tab === "logs" ? "bg-brand-600 text-white" : "text-muted hover:text-ink"}`}>Daily logs ({lg.filter((l) => !l.verified).length} pending)</button>
      </div>
      {tab === "subs"
        ? <SubsTable rows={subs} onChange={(id, v) => setSubs((xs) => xs.map((x) => (x.id === id ? { ...x, verified: v } : x)))} />
        : <LogsTable rows={lg} onChange={(id, v) => setLg((xs) => xs.map((x) => (x.id === id ? { ...x, verified: v } : x)))} />}
    </Card>
  );
}

function VerifyToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return on
    ? <button onClick={onClick} title="Click to unverify" className="rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-600">✓ Verified</button>
    : <button onClick={onClick} className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700">Verify</button>;
}

function BulkVerify({ onClick, busy, n }: { onClick: () => void; busy: boolean; n: number }) {
  if (n === 0) return null;
  return <div className="mb-2 flex justify-end"><button onClick={onClick} disabled={busy} className="rounded-md border border-line px-3 py-1.5 text-xs hover:bg-canvas disabled:opacity-50">{busy ? "…" : `Verify all ${n} pending on this page`}</button></div>;
}

function SubsTable({ rows, onChange }: { rows: Sub[]; onChange: (id: string, v: boolean) => void }) {
  const pg = usePaged(rows, 20);
  const [busy, setBusy] = useState(false);
  async function toggle(id: string, v: boolean) {
    onChange(id, v);
    const res = await setSubmissionVerified([id], v);
    if (!res.ok) { toast(res.error ?? "Failed", "error"); onChange(id, !v); }
  }
  async function bulk() {
    const ids = pg.slice.filter((r) => !r.verified).map((r) => r.id);
    if (!ids.length) return;
    setBusy(true); ids.forEach((id) => onChange(id, true));
    const res = await setSubmissionVerified(ids, true); setBusy(false);
    if (!res.ok) toast(res.error ?? "Failed", "error"); else toast(`Verified ${ids.length}`, "success");
  }
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">No submissions from other recruiters in the last 60 days.</p>;
  return (
    <>
      <BulkVerify onClick={bulk} busy={busy} n={pg.slice.filter((r) => !r.verified).length} />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-2 pr-3 font-medium">Recruiter</th><th className="pr-3 font-medium">Candidate</th><th className="pr-3 font-medium">Requirement</th><th className="pr-3 font-medium">Stage</th><th className="pr-3 font-medium">Date</th><th className="font-medium">Status</th></tr></thead>
          <tbody>
            {pg.slice.map((r) => (
              <tr key={r.id} className="border-t border-line/60">
                <td className="py-2 pr-3 font-medium">{r.recruiter}</td>
                <td className="pr-3">{r.candidate}</td>
                <td className="pr-3 text-muted">{r.requirement}</td>
                <td className="pr-3 text-muted">{r.status}</td>
                <td className="pr-3 text-muted">{r.date}</td>
                <td><VerifyToggle on={r.verified} onClick={() => toggle(r.id, !r.verified)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={pg.page} pageCount={pg.pageCount} setPage={pg.setPage} total={pg.total} pageSize={pg.pageSize} />
    </>
  );
}

function LogsTable({ rows, onChange }: { rows: Log[]; onChange: (id: string, v: boolean) => void }) {
  const pg = usePaged(rows, 20);
  const [busy, setBusy] = useState(false);
  async function toggle(id: string, v: boolean) {
    onChange(id, v);
    const res = await setDailyVerified([id], v);
    if (!res.ok) { toast(res.error ?? "Failed", "error"); onChange(id, !v); }
  }
  async function bulk() {
    const ids = pg.slice.filter((r) => !r.verified).map((r) => r.id);
    if (!ids.length) return;
    setBusy(true); ids.forEach((id) => onChange(id, true));
    const res = await setDailyVerified(ids, true); setBusy(false);
    if (!res.ok) toast(res.error ?? "Failed", "error"); else toast(`Verified ${ids.length}`, "success");
  }
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">No daily logs from other recruiters in the last 60 days.</p>;
  return (
    <>
      <BulkVerify onClick={bulk} busy={busy} n={pg.slice.filter((r) => !r.verified).length} />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-2 pr-3 font-medium">Recruiter</th><th className="pr-3 font-medium">Division</th><th className="pr-3 font-medium">Date</th><th className="pr-3 font-medium">Sourced</th><th className="pr-3 font-medium">Parsed</th><th className="pr-3 font-medium">Notes</th><th className="font-medium">Status</th></tr></thead>
          <tbody>
            {pg.slice.map((r) => (
              <tr key={r.id} className="border-t border-line/60">
                <td className="py-2 pr-3 font-medium">{r.recruiter}</td>
                <td className="pr-3 text-muted">{r.division}</td>
                <td className="pr-3 text-muted">{r.date}</td>
                <td className="pr-3">{r.sourced}</td>
                <td className="pr-3">{r.parsed}</td>
                <td className="max-w-[16rem] truncate pr-3 text-muted" title={r.notes}>{r.notes || "—"}</td>
                <td><VerifyToggle on={r.verified} onClick={() => toggle(r.id, !r.verified)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={pg.page} pageCount={pg.pageCount} setPage={pg.setPage} total={pg.total} pageSize={pg.pageSize} />
    </>
  );
}
