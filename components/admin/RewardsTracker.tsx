"use client";
import { useMemo, useState } from "react";
import { Gift, Check, X, Send, Loader2, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui";
import { toast } from "@/components/uikit";
import { prettyDate } from "@/lib/dates";
import { confirmReward, rejectReward, markInitiated, resendHrEmail } from "@/app/manager/rewards/actions";

type Reward = {
  id: string;
  status: string;
  candidate_name: string | null;
  requirement_title: string | null;
  recruiter_name: string;
  manager_name: string | null;
  hr_email: string | null;
  manager_confirmed_at: string | null;
  hr_decided_at: string | null;
  initiated_at: string | null;
  note: string | null;
  amount?: number | null;
  currency?: string | null;
  hr_comment?: string | null;
  source?: string | null;
  created_at: string;
};

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending_manager:   { label: "Awaiting manager", color: "#b45309", bg: "#fffbeb" },
  manager_confirmed: { label: "Awaiting HR",      color: "#1d4ed8", bg: "#eff6ff" },
  hr_approved:       { label: "HR approved",      color: "#15803d", bg: "#f0fdf4" },
  hr_rejected:       { label: "HR declined",      color: "#b91c1c", bg: "#fef2f2" },
  rejected:          { label: "Rejected",         color: "#b91c1c", bg: "#fef2f2" },
  initiated:         { label: "Paid",             color: "#6d28d9", bg: "#f5f3ff" },
};

function money(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount === null || amount === undefined) return null;
  const sym = currency === "USD" ? "$" : currency === "INR" ? "₹" : "";
  return `${sym}${Number(amount).toLocaleString(currency === "USD" ? "en-US" : "en-IN")}`;
}

const STEPS = ["Requested", "Manager confirmed", "HR approved", "Paid"];
function stepIndex(status: string): number {
  if (status === "initiated") return 4;
  if (status === "hr_approved") return 3;
  if (status === "manager_confirmed") return 2;
  if (status === "pending_manager") return 1;
  return 0; // rejected / hr_rejected
}

export default function RewardsTracker({ rewards, hint }: { rewards: Reward[]; hint?: string }) {
  const [filter, setFilter] = useState<string>("active");
  const [busy, setBusy] = useState<string | null>(null);
  const [local, setLocal] = useState(rewards);
  // Manager's proposed amount per pending row (HR sees it pre-filled).
  const [draft, setDraft] = useState<Record<string, { amount: string; currency: "INR" | "USD" }>>({});

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: local.length, active: 0, done: 0 };
    for (const r of local) {
      if (r.status === "initiated" || r.status === "rejected" || r.status === "hr_rejected") c.done++;
      else c.active++;
    }
    return c;
  }, [local]);

  const shown = local.filter((r) => {
    if (filter === "all") return true;
    const done = r.status === "initiated" || r.status === "rejected" || r.status === "hr_rejected";
    return filter === "done" ? done : !done;
  });

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string, patch: Partial<Reward>) {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (!res.ok) { toast(res.error ?? "Something went wrong", "error"); return; }
    toast(okMsg, "success");
    setLocal((xs) => xs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Gift size={22} className="text-brand-600" /> Rewards</h1>
          <p className="text-sm text-muted">{hint ?? "Closure rewards — confirm, send to HR, and track to payout."}</p>
        </div>
        <div className="flex rounded-lg border border-line p-0.5 text-sm">
          {[["active", `Active (${counts.active})`], ["done", `Closed (${counts.done})`], ["all", `All (${counts.all})`]].map(([k, lbl]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`rounded-md px-3 py-1 ${filter === k ? "bg-brand-600 text-white" : "text-muted hover:text-ink"}`}>{lbl}</button>
          ))}
        </div>
      </div>

      <Card>
        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No rewards here yet. They appear automatically when a recruiter records a closure.</p>
        ) : (
          <div className="space-y-3">
            {shown.map((r) => {
              const s = STATUS[r.status] ?? { label: r.status, color: "#475569", bg: "#f1f5f9" };
              const si = stepIndex(r.status);
              const terminalReject = r.status === "rejected" || r.status === "hr_rejected";
              return (
                <div key={r.id} className="rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{r.candidate_name ?? "Candidate"}</span>
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: s.color, background: s.bg }}>{s.label}</span>
                        {r.source === "recruiter_request" && <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-600">Requested</span>}
                        {money(r.amount, r.currency) && <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-ink">{money(r.amount, r.currency)}</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {r.requirement_title ?? "—"} · by <b className="text-ink/80">{r.recruiter_name}</b>
                        {r.manager_name ? ` · confirmed by ${r.manager_name}` : ""} · {prettyDate(r.created_at.slice(0, 10), { weekday: "short" })}
                      </div>
                      {r.note && <div className="mt-1 text-xs text-muted">Note: {r.note}</div>}
                      {r.hr_comment && <div className="mt-1 text-xs text-danger-600">HR: {r.hr_comment}</div>}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {r.status === "pending_manager" && (
                        <>
                          <div className="flex items-center overflow-hidden rounded-lg border border-line">
                            {(["INR", "USD"] as const).map((c) => {
                              const cur = draft[r.id]?.currency ?? (r.currency === "USD" ? "USD" : "INR");
                              return (
                                <button key={c} type="button" onClick={() => setDraft((d) => ({ ...d, [r.id]: { amount: d[r.id]?.amount ?? "", currency: c } }))}
                                  className={`px-2 py-1.5 text-xs ${cur === c ? "bg-brand-600 text-white" : "text-muted hover:text-ink"}`}>{c === "INR" ? "₹" : "$"}</button>
                              );
                            })}
                          </div>
                          <input type="number" min="0" inputMode="decimal" placeholder="Amount" value={draft[r.id]?.amount ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, [r.id]: { amount: e.target.value, currency: d[r.id]?.currency ?? (r.currency === "USD" ? "USD" : "INR") } }))}
                            className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                          <button disabled={busy === r.id} onClick={() => {
                            const d = draft[r.id];
                            const amt = d?.amount ? Number(d.amount) : null;
                            const cur = d?.currency ?? "INR";
                            run(r.id, () => confirmReward(r.id, { amount: amt, currency: cur }), "Confirmed — sent to HR", { status: "manager_confirmed", manager_confirmed_at: new Date().toISOString(), amount: amt ?? r.amount ?? null, currency: amt != null ? cur : r.currency ?? null });
                          }}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                            {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirm
                          </button>
                          <button disabled={busy === r.id} onClick={() => { const why = prompt("Reason for rejecting (optional):") ?? undefined; run(r.id, () => rejectReward(r.id, why), "Rejected", { status: "rejected" }); }}
                            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-danger-600">
                            <X size={14} /> Reject
                          </button>
                        </>
                      )}
                      {r.status === "manager_confirmed" && (
                        <button disabled={busy === r.id} onClick={() => run(r.id, () => resendHrEmail(r.id), "HR re-notified", {})}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">
                          {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Re-notify HR
                        </button>
                      )}
                      {r.status === "hr_approved" && (
                        <button disabled={busy === r.id} onClick={() => run(r.id, () => markInitiated(r.id), "Marked paid", { status: "initiated", initiated_at: new Date().toISOString() })}
                          className="inline-flex items-center gap-1 rounded-lg bg-success-600 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                          {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />} Mark paid
                        </button>
                      )}
                    </div>
                  </div>

                  {/* status timeline */}
                  {!terminalReject && (
                    <div className="mt-3 flex items-center gap-1">
                      {STEPS.map((label, i) => (
                        <div key={label} className="flex flex-1 items-center gap-1">
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${i < si ? "bg-brand-600 text-white" : i === si ? "bg-brand-100 text-brand-700 ring-2 ring-brand-300" : "bg-canvas text-muted"}`}>
                            {i < si ? "✓" : i + 1}
                          </span>
                          <span className={`truncate text-[11px] ${i < si ? "text-ink" : "text-muted"}`}>{label}</span>
                          {i < STEPS.length - 1 && <span className={`h-px flex-1 ${i < si ? "bg-brand-300" : "bg-line"}`} />}
                        </div>
                      ))}
                    </div>
                  )}
                  {terminalReject && (
                    <div className="mt-2 flex items-center gap-1 text-xs font-medium text-danger-600"><RotateCcw size={12} /> {STATUS[r.status]?.label}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
