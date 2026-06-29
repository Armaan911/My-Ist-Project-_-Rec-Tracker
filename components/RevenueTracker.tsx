"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, Modal } from "@/components/ui";
import { toast } from "@/components/uikit";
import { setClosureRevenue } from "@/app/manager/revenue/actions";

type Closure = {
  id: string; recruiterId: string; recruiter: string; candidate: string; requirement: string; date: string; startDate: string | null;
  incentive: number | null; incentiveCurrency: string; revenueValue: number | null; revenueCurrency: string;
  monthlyProfit: number | null; contractMonths: number | null; closedRate: number | null; closedRateCurrency: string;
};

const TIMEOUT_SECONDS = 120; // page locks after 2 minutes
const money = (n: number, cur: string) => (cur === "USD" ? "$" : "₹") + n.toLocaleString("en-IN");

function buildSchedule(c: Closure) {
  if (!c.monthlyProfit || !c.contractMonths) return [] as { label: string; cumulative: number }[];
  const start = c.startDate ? new Date(c.startDate) : new Date();
  const out: { label: string; cumulative: number }[] = [];
  for (let i = 0; i < c.contractMonths; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    out.push({ label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }), cumulative: c.monthlyProfit * (i + 1) });
  }
  return out;
}

export default function RevenueTracker({ closures: initial, canEdit }: { closures: Closure[]; canEdit: boolean }) {
  const [closures, setClosures] = useState<Closure[]>(initial);
  const [left, setLeft] = useState(TIMEOUT_SECONDS);
  const [locked, setLocked] = useState(false);
  const [schedule, setSchedule] = useState<Closure | null>(null);

  useEffect(() => {
    const deadline = Date.now() + TIMEOUT_SECONDS * 1000;
    const iv = setInterval(() => {
      const s = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) { setLocked(true); clearInterval(iv); }
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const groups = useMemo(() => {
    const m = new Map<string, { recruiter: string; items: Closure[]; INR: number; USD: number }>();
    for (const c of closures) {
      const g = m.get(c.recruiterId) ?? { recruiter: c.recruiter, items: [], INR: 0, USD: 0 };
      g.items.push(c);
      if (c.revenueValue) { if (c.revenueCurrency === "USD") g.USD += c.revenueValue; else g.INR += c.revenueValue; }
      m.set(c.recruiterId, g);
    }
    return Array.from(m.values()).sort((a, b) => b.INR + b.USD - (a.INR + a.USD));
  }, [closures]);

  const totals = useMemo(() => {
    let INR = 0, USD = 0, mrrINR = 0, mrrUSD = 0;
    for (const c of closures) {
      if (c.revenueValue) (c.revenueCurrency === "USD" ? (USD += c.revenueValue) : (INR += c.revenueValue));
      if (c.monthlyProfit) (c.revenueCurrency === "USD" ? (mrrUSD += c.monthlyProfit) : (mrrINR += c.monthlyProfit));
    }
    return { INR, USD, mrrINR, mrrUSD };
  }, [closures]);

  function patch(id: string, p: Partial<Closure>) {
    setClosures((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  if (locked) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <div className="py-10">
          <div className="text-5xl">🔒</div>
          <h2 className="mt-4 text-lg font-bold">Revenue view timed out</h2>
          <p className="mt-1 text-sm text-muted">For security this page locks after 2 minutes. Reopen to view again.</p>
          <button onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Reopen revenue</button>
        </div>
      </Card>
    );
  }

  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, "0");
  const dual = (inr: number, usd: number) =>
    inr === 0 && usd === 0 ? "—" : `${inr > 0 ? money(inr, "INR") : ""}${inr > 0 && usd > 0 ? " · " : ""}${usd > 0 ? money(usd, "USD") : ""}`;

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Revenue tracker</h1>
          <p className="text-sm text-muted">Each closure earns a <b>monthly profit</b> over the <b>contract duration</b> — total = monthly × months. Managers and HR set these; recruiters enter the closed rate.</p>
        </div>
        <div className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${left <= 20 ? "border-danger-600/40 bg-danger-50 text-danger-600" : "border-line text-muted"}`}>
          Auto-locks in {mm}:{ss}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><div className="text-xs uppercase tracking-wide text-muted">Total contract revenue (INR)</div><div className="text-2xl font-bold text-success-600">{money(totals.INR, "INR")}</div></Card>
        <Card><div className="text-xs uppercase tracking-wide text-muted">Total contract revenue (USD)</div><div className="text-2xl font-bold text-success-600">{money(totals.USD, "USD")}</div></Card>
        <Card><div className="text-xs uppercase tracking-wide text-muted">Monthly run-rate</div><div className="text-2xl font-bold text-brand-700">{dual(totals.mrrINR, totals.mrrUSD)}</div></Card>
      </div>

      {groups.length === 0 ? (
        <Card><p className="py-8 text-center text-sm text-muted">No closures yet to attribute revenue to.</p></Card>
      ) : groups.map((g) => (
        <Card key={g.recruiter}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{g.recruiter}</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted">{g.items.length} closure{g.items.length === 1 ? "" : "s"}</span>
              <span className="rounded-full bg-success-50 px-2.5 py-0.5 font-semibold text-success-600">{dual(g.INR, g.USD)}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr><th className="py-2 pr-3 font-medium">Candidate</th><th className="pr-3 font-medium">Requirement</th><th className="pr-3 font-medium">Closed</th><th className="pr-3 font-medium">Closed rate</th><th className="font-medium">Monthly profit × duration</th></tr>
              </thead>
              <tbody>
                {g.items.map((c) => (
                  <tr key={c.id} className="border-t border-line/60">
                    <td className="py-2 pr-3 font-medium">{c.candidate}</td>
                    <td className="pr-3 text-muted">{c.requirement}</td>
                    <td className="pr-3 text-muted">{c.date}</td>
                    <td className="pr-3 text-muted">{c.closedRate != null ? money(c.closedRate, c.closedRateCurrency) : "—"}</td>
                    <td>
                      <ContractEditor c={c} canEdit={canEdit} onSchedule={() => setSchedule(c)}
                        onSaved={(mp, cm, cur) => patch(c.id, { monthlyProfit: mp, contractMonths: cm, revenueValue: mp != null && cm != null ? mp * cm : null, revenueCurrency: cur })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {schedule && (
        <Modal open onClose={() => setSchedule(null)} wide title={`Revenue schedule — ${schedule.candidate}`}
          description={`${money(schedule.monthlyProfit ?? 0, schedule.revenueCurrency)}/mo × ${schedule.contractMonths} months = ${money((schedule.monthlyProfit ?? 0) * (schedule.contractMonths ?? 0), schedule.revenueCurrency)}`}>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted">
                <tr><th className="py-2 pr-3 font-medium">#</th><th className="pr-3 font-medium">Month</th><th className="pr-3 text-right font-medium">This month</th><th className="text-right font-medium">Cumulative</th></tr>
              </thead>
              <tbody>
                {buildSchedule(schedule).map((row, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="py-2 pr-3 text-muted">{i + 1}</td>
                    <td className="pr-3">{row.label}</td>
                    <td className="pr-3 text-right">{money(schedule.monthlyProfit ?? 0, schedule.revenueCurrency)}</td>
                    <td className="text-right font-semibold">{money(row.cumulative, schedule.revenueCurrency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ContractEditor({ c, canEdit, onSaved, onSchedule }: {
  c: Closure; canEdit: boolean; onSaved: (mp: number | null, cm: number | null, cur: string) => void; onSchedule: () => void;
}) {
  const hasValue = c.monthlyProfit != null && c.contractMonths != null;
  const [editing, setEditing] = useState(canEdit && !hasValue);
  const [mp, setMp] = useState(c.monthlyProfit != null ? String(c.monthlyProfit) : "");
  const [cm, setCm] = useState(c.contractMonths != null ? String(c.contractMonths) : "");
  const [cur, setCur] = useState(c.revenueCurrency || "INR");
  const [busy, setBusy] = useState(false);

  async function save() {
    const mpn = mp.trim() === "" ? null : Number(mp);
    const cmn = cm.trim() === "" ? null : Number(cm);
    if (mpn != null && (isNaN(mpn) || mpn < 0)) { toast("Enter a valid monthly profit", "error"); return; }
    if (cmn != null && (isNaN(cmn) || cmn < 0)) { toast("Enter a valid number of months", "error"); return; }
    setBusy(true);
    const res = await setClosureRevenue(c.id, { monthlyProfit: mpn, contractMonths: cmn, currency: cur });
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Failed to save", "error"); return; }
    onSaved(mpn, cmn, cur); setEditing(false); toast("Revenue saved", "success");
  }

  if (!editing) {
    const total = hasValue ? c.monthlyProfit! * c.contractMonths! : null;
    return (
      <div className="flex flex-wrap items-center gap-2 py-1">
        {hasValue ? (
          <>
            <span className="text-muted">{money(c.monthlyProfit!, c.revenueCurrency)}/mo × {c.contractMonths}mo =</span>
            <span className="font-semibold text-success-600">{money(total!, c.revenueCurrency)}</span>
            <button onClick={onSchedule} className="rounded-md border border-line px-2 py-0.5 text-xs text-muted hover:border-brand-300 hover:text-ink">Schedule</button>
          </>
        ) : <span className="text-muted">—</span>}
        {canEdit && <button onClick={() => setEditing(true)} className="rounded-md border border-line px-2 py-0.5 text-xs text-muted hover:border-brand-300 hover:text-ink">{hasValue ? "Edit" : "Add"}</button>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
      <select value={cur} onChange={(e) => setCur(e.target.value)} className="h-8 rounded-md border border-line bg-surface px-1 text-xs"><option value="INR">₹</option><option value="USD">$</option></select>
      <input value={mp} onChange={(e) => setMp(e.target.value)} inputMode="decimal" placeholder="profit/mo" className="h-8 w-24 rounded-md border border-line bg-surface px-2 text-sm" />
      <span className="text-xs text-muted">×</span>
      <input value={cm} onChange={(e) => setCm(e.target.value)} inputMode="numeric" placeholder="months" className="h-8 w-20 rounded-md border border-line bg-surface px-2 text-sm" />
      <button onClick={save} disabled={busy} className="h-8 rounded-md bg-brand-600 px-2.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40">{busy ? "…" : "Save"}</button>
      {hasValue && <button onClick={() => { setMp(String(c.monthlyProfit)); setCm(String(c.contractMonths)); setCur(c.revenueCurrency); setEditing(false); }} className="h-8 rounded-md border border-line px-2 text-xs text-muted hover:text-ink">Cancel</button>}
    </div>
  );
}
