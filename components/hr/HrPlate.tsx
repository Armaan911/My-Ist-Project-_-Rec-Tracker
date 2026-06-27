"use client";
import { useState } from "react";
import { Check, X, Loader2, Banknote } from "lucide-react";
import { Card, Input } from "@/components/ui";
import { toast } from "@/components/uikit";
import { prettyDate } from "@/lib/dates";
import { approveIncentive, denyIncentive } from "@/app/hr/actions";

type Item = {
  id: string;
  candidate_name: string | null;
  requirement_title: string | null;
  recruiter_name: string;
  manager_name: string | null;
  division_name: string | null;
  confirmed_at: string | null;
  created_at: string;
  amount?: number | null;
  currency?: string | null;
  reason?: string | null;
};

export default function HrPlate({ items }: { items: Item[] }) {
  const [list, setList] = useState(items);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Banknote size={22} className="text-brand-600" /> My Plate</h1>
        <p className="text-sm text-muted">Incentive requests awaiting your decision. Set the amount, then approve or deny.</p>
      </div>
      {list.length === 0 ? (
        <Card><p className="py-10 text-center text-sm text-muted">Nothing on your plate right now. New requests appear here when a manager confirms a closure.</p></Card>
      ) : (
        <div className="space-y-3">
          {list.map((it) => <Row key={it.id} it={it} onDone={(id) => setList((xs) => xs.filter((x) => x.id !== id))} />)}
        </div>
      )}
    </div>
  );
}

function Row({ it, onDone }: { it: Item; onDone: (id: string) => void }) {
  const [amount, setAmount] = useState(it.amount != null ? String(it.amount) : "");
  const [currency, setCurrency] = useState<"INR" | "USD">(it.currency === "USD" ? "USD" : "INR");
  const [denying, setDenying] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "deny">(null);

  async function approve() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast("Enter a valid amount", "error"); return; }
    setBusy("approve");
    const res = await approveIncentive(it.id, { amount: amt, currency });
    setBusy(null);
    if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
    toast("Incentive approved — payroll notified", "success");
    onDone(it.id);
  }
  async function deny() {
    if (!comment.trim()) { toast("A comment is required to deny", "error"); return; }
    setBusy("deny");
    const res = await denyIncentive(it.id, { comment: comment.trim() });
    setBusy(null);
    if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
    toast("Request declined — manager & recruiter notified", "success");
    onDone(it.id);
  }

  return (
    <Card className="p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{it.candidate_name ?? "Candidate"}</span>
          {it.division_name && <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">{it.division_name}</span>}
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {it.requirement_title ?? "—"} · closed by <b className="text-ink/80">{it.recruiter_name}</b>
          {it.manager_name ? ` · confirmed by ${it.manager_name}` : ""}
          {it.confirmed_at ? ` · ${prettyDate(it.confirmed_at.slice(0, 10), { weekday: "short" })}` : ""}
        </div>
        {it.reason && <div className="mt-1 text-xs text-muted">“{it.reason}”</div>}
        {it.amount != null && (
          <div className="mt-1 text-xs font-medium text-accent-600">
            Manager proposed {it.currency === "USD" ? "$" : "₹"}{Number(it.amount).toLocaleString(it.currency === "USD" ? "en-US" : "en-IN")} — adjust below if needed.
          </div>
        )}
      </div>

      {!denying ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-line">
            {(["INR", "USD"] as const).map((c) => (
              <button key={c} type="button" onClick={() => setCurrency(c)}
                className={`px-2.5 py-2 text-sm transition-colors ${currency === c ? "bg-brand-600 text-white" : "text-muted hover:text-ink"}`}>
                {c === "INR" ? "₹ INR" : "$ USD"}
              </button>
            ))}
          </div>
          <Input type="number" min="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount" className="w-32" />
          <button disabled={busy !== null} onClick={approve}
            className="inline-flex items-center gap-1 rounded-lg bg-success-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {busy === "approve" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve
          </button>
          <button disabled={busy !== null} onClick={() => setDenying(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-danger-600">
            <X size={14} /> Deny
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} autoFocus
            placeholder="Reason for declining (shared with the manager and recruiter)…"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100" />
          <div className="flex items-center gap-2">
            <button disabled={busy !== null} onClick={deny}
              className="inline-flex items-center gap-1 rounded-lg bg-danger-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {busy === "deny" ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Confirm deny
            </button>
            <button disabled={busy !== null} onClick={() => { setDenying(false); setComment(""); }}
              className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink">Cancel</button>
          </div>
        </div>
      )}
    </Card>
  );
}
