"use client";
import { useState } from "react";
import { Check, X, Loader2, Gift } from "lucide-react";
import { Card } from "@/components/ui";
import { toast } from "@/components/uikit";
import { prettyDate } from "@/lib/dates";
import { confirmReward, rejectReward } from "@/app/manager/rewards/actions";

type Item = {
  id: string;
  candidate_name: string | null;
  requirement_title: string | null;
  recruiter_name: string;
  created_at: string;
};

// Closure approvals shown in the Approvals tab (alongside past-day change requests).
// Approving sends the closure's incentive to HR; the manager can propose an amount.
export default function ClosureApprovals({ items }: { items: Item[] }) {
  const [list, setList] = useState(items);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { amount: string; currency: "INR" | "USD" }>>({});

  async function approve(id: string) {
    const d = draft[id];
    const amt = d?.amount ? Number(d.amount) : null;
    setBusy(id);
    const res = await confirmReward(id, { amount: amt, currency: d?.currency ?? "INR" });
    setBusy(null);
    if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
    toast("Closure approved — sent to HR", "success");
    setList((xs) => xs.filter((x) => x.id !== id));
  }
  async function reject(id: string) {
    const why = prompt("Reason for rejecting (optional):") ?? undefined;
    setBusy(id);
    const res = await rejectReward(id, why);
    setBusy(null);
    if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
    toast("Closure rejected", "success");
    setList((xs) => xs.filter((x) => x.id !== id));
  }

  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Gift size={18} className="text-brand-600" /> Closure approvals</h2>
      <p className="mb-3 text-sm text-muted">Closures recorded by recruiters — approve to send the incentive to HR (optionally propose an amount), or reject.</p>
      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No closures awaiting approval.</p>
      ) : (
        <div className="space-y-3">
          {list.map((it) => (
            <div key={it.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{it.candidate_name ?? "Candidate"}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {it.requirement_title ?? "—"} · by <b className="text-ink/80">{it.recruiter_name}</b> · {prettyDate(it.created_at.slice(0, 10), { weekday: "short" })}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <div className="flex items-center overflow-hidden rounded-lg border border-line">
                    {(["INR", "USD"] as const).map((c) => {
                      const cur = draft[it.id]?.currency ?? "INR";
                      return (
                        <button key={c} type="button" onClick={() => setDraft((d) => ({ ...d, [it.id]: { amount: d[it.id]?.amount ?? "", currency: c } }))}
                          className={`px-2 py-1.5 text-xs ${cur === c ? "bg-brand-600 text-white" : "text-muted hover:text-ink"}`}>{c === "INR" ? "₹" : "$"}</button>
                      );
                    })}
                  </div>
                  <input type="number" min="0" placeholder="Amount" value={draft[it.id]?.amount ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [it.id]: { amount: e.target.value, currency: d[it.id]?.currency ?? "INR" } }))}
                    className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm focus:border-brand-600 focus:outline-none" />
                  <button disabled={busy === it.id} onClick={() => approve(it.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-success-600 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                    {busy === it.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve
                  </button>
                  <button disabled={busy === it.id} onClick={() => reject(it.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-danger-600">
                    <X size={14} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
