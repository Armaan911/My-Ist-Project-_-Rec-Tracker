"use client";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { toast } from "@/components/uikit";
import { setRevenueValue } from "@/app/manager/revenue/actions";

type Closure = {
  id: string; recruiterId: string; recruiter: string; candidate: string; requirement: string; date: string;
  incentive: number | null; incentiveCurrency: string; revenueValue: number | null; revenueCurrency: string;
};

const TIMEOUT_SECONDS = 120; // page locks after 2 minutes
const money = (n: number, cur: string) => (cur === "USD" ? "$" : "₹") + n.toLocaleString("en-IN");

export default function RevenueTracker({ closures: initial }: { closures: Closure[] }) {
  const [closures, setClosures] = useState<Closure[]>(initial);
  const [left, setLeft] = useState(TIMEOUT_SECONDS);
  const [locked, setLocked] = useState(false);

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
    let INR = 0, USD = 0;
    for (const c of closures) if (c.revenueValue) { c.revenueCurrency === "USD" ? (USD += c.revenueValue) : (INR += c.revenueValue); }
    return { INR, USD };
  }, [closures]);

  function patch(id: string, v: number | null, cur: string) {
    setClosures((xs) => xs.map((x) => (x.id === id ? { ...x, revenueValue: v, revenueCurrency: cur } : x)));
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
  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Revenue tracker</h1>
          <p className="text-sm text-muted">Placement value generated per recruiter. Visible to managers only.</p>
        </div>
        <div className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${left <= 20 ? "border-danger-600/40 bg-danger-50 text-danger-600" : "border-line text-muted"}`}>
          Auto-locks in {mm}:{ss}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card><div className="text-xs uppercase tracking-wide text-muted">Total revenue (INR)</div><div className="text-2xl font-bold text-success-600">{money(totals.INR, "INR")}</div></Card>
        <Card><div className="text-xs uppercase tracking-wide text-muted">Total revenue (USD)</div><div className="text-2xl font-bold text-success-600">{money(totals.USD, "USD")}</div></Card>
      </div>

      {groups.length === 0 ? (
        <Card><p className="py-8 text-center text-sm text-muted">No closures yet to attribute revenue to.</p></Card>
      ) : groups.map((g) => (
        <Card key={g.recruiter}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{g.recruiter}</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted">{g.items.length} closure{g.items.length === 1 ? "" : "s"}</span>
              <span className="rounded-full bg-success-50 px-2.5 py-0.5 font-semibold text-success-600">
                {g.INR > 0 ? money(g.INR, "INR") : ""}{g.INR > 0 && g.USD > 0 ? " · " : ""}{g.USD > 0 ? money(g.USD, "USD") : ""}{g.INR === 0 && g.USD === 0 ? "—" : ""}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr><th className="py-2 pr-3 font-medium">Candidate</th><th className="pr-3 font-medium">Requirement</th><th className="pr-3 font-medium">Closed</th><th className="font-medium">Placement value</th></tr>
              </thead>
              <tbody>
                {g.items.map((c) => (
                  <tr key={c.id} className="border-t border-line/60">
                    <td className="py-2 pr-3 font-medium">{c.candidate}</td>
                    <td className="pr-3 text-muted">{c.requirement}</td>
                    <td className="pr-3 text-muted">{c.date}</td>
                    <td><ValueEditor c={c} onSaved={(v, cur) => patch(c.id, v, cur)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ValueEditor({ c, onSaved }: { c: Closure; onSaved: (v: number | null, cur: string) => void }) {
  const [val, setVal] = useState(c.revenueValue != null ? String(c.revenueValue) : "");
  const [cur, setCur] = useState(c.revenueCurrency || "INR");
  const [busy, setBusy] = useState(false);
  const dirty = (val.trim() === "" ? null : Number(val)) !== c.revenueValue || cur !== c.revenueCurrency;

  async function save() {
    const num = val.trim() === "" ? null : Number(val);
    if (num != null && (isNaN(num) || num < 0)) { toast("Enter a valid amount", "error"); return; }
    setBusy(true);
    const res = await setRevenueValue(c.id, num, cur);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Failed to save", "error"); return; }
    onSaved(num, cur); toast("Revenue saved", "success");
  }

  return (
    <div className="flex items-center gap-1.5 py-1">
      <select value={cur} onChange={(e) => setCur(e.target.value)} className="h-8 rounded-md border border-line bg-surface px-1 text-xs">
        <option value="INR">₹</option><option value="USD">$</option>
      </select>
      <input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" placeholder="0"
        className="h-8 w-28 rounded-md border border-line bg-surface px-2 text-sm" />
      <button onClick={save} disabled={busy || !dirty}
        className="h-8 rounded-md bg-brand-600 px-2.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40">
        {busy ? "…" : "Save"}
      </button>
    </div>
  );
}
