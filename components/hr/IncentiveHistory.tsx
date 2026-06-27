"use client";
import { useMemo, useState } from "react";
import { Download, Loader2, BadgeCheck } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { toast } from "@/components/uikit";
import { prettyDate } from "@/lib/dates";
import { markPaid } from "@/app/hr/actions";
import { buildIncentivesCsv } from "@/app/hr/export-actions";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
type Row = {
  id: string;
  status: string;
  candidate_name: string | null;
  requirement_title: string | null;
  recruiter_name: string;
  manager_name: string | null;
  hr_name: string | null;
  amount: number | null;
  currency: string | null;
  hr_comment: string | null;
  created_at: string;
  hr_decided_at: string | null;
  initiated_at: string | null;
};

const STATUS: Record<string, { label: string; tone: Tone }> = {
  pending_manager:   { label: "Awaiting manager", tone: "warning" },
  manager_confirmed: { label: "Awaiting HR", tone: "info" },
  hr_approved:       { label: "Approved", tone: "success" },
  hr_rejected:       { label: "Declined", tone: "danger" },
  rejected:          { label: "Rejected", tone: "danger" },
  initiated:         { label: "Paid", tone: "brand" },
};

function money(amount: number | null, currency: string | null) {
  if (amount === null || amount === undefined) return "—";
  const sym = currency === "USD" ? "$" : currency === "INR" ? "₹" : "";
  return `${sym}${Number(amount).toLocaleString(currency === "USD" ? "en-US" : "en-IN")}`;
}

const FILTERS: [string, string][] = [
  ["all", "All"],
  ["manager_confirmed", "Awaiting HR"],
  ["hr_approved", "Approved"],
  ["initiated", "Paid"],
  ["hr_rejected", "Declined"],
];

export default function IncentiveHistory({ rows: initial, canMarkPaid = true, subtitle = "Every incentive request and where it stands." }: { rows: Row[]; canMarkPaid?: boolean; subtitle?: string }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const shown = useMemo(() => rows.filter((r) => (filter === "all" ? true : r.status === filter)), [rows, filter]);

  async function pay(id: string) {
    setBusy(id);
    const res = await markPaid(id);
    setBusy(null);
    if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
    toast("Marked paid", "success");
    setRows((xs) => xs.map((r) => (r.id === id ? { ...r, status: "initiated", initiated_at: new Date().toISOString() } : r)));
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await buildIncentivesCsv();
      if (!res.ok) { toast(res.error || "Export failed", "error"); return; }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast("Incentives CSV downloaded", "success");
    } catch {
      toast("Export failed", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Incentive history</h1>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        <button onClick={exportCsv} disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-50">
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Export CSV
        </button>
      </div>

      <div className="flex w-fit flex-wrap gap-1 rounded-lg border border-line p-0.5 text-sm">
        {FILTERS.map(([k, lbl]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-md px-3 py-1 ${filter === k ? "bg-brand-600 text-white" : "text-muted hover:text-ink"}`}>{lbl}</button>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="p-3 font-medium">Candidate / Requirement</th>
                <th className="p-3 font-medium">Recruiter</th>
                <th className="p-3 font-medium">Amount</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const s = STATUS[r.status] ?? { label: r.status, tone: "neutral" as Tone };
                return (
                  <tr key={r.id} className="border-b border-line/60 align-top">
                    <td className="p-3">
                      <div className="font-medium">{r.candidate_name ?? "Candidate"}</div>
                      <div className="text-xs text-muted">{r.requirement_title ?? "—"}</div>
                      {r.hr_comment && <div className="mt-1 text-xs text-danger-600">“{r.hr_comment}”</div>}
                    </td>
                    <td className="p-3 text-muted">{r.recruiter_name}</td>
                    <td className="p-3 font-medium">{money(r.amount, r.currency)}</td>
                    <td className="p-3"><Badge tone={s.tone}>{s.label}</Badge></td>
                    <td className="p-3 text-xs text-muted">{prettyDate((r.initiated_at ?? r.hr_decided_at ?? r.created_at).slice(0, 10), { weekday: "short" })}</td>
                    <td className="p-3 text-right">
                      {canMarkPaid && r.status === "hr_approved" && (
                        <button disabled={busy === r.id} onClick={() => pay(r.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                          {busy === r.id ? <Loader2 size={12} className="animate-spin" /> : <BadgeCheck size={12} />} Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted">No incentives in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
