"use client";
import { useState } from "react";
import { toast } from "@/components/uikit";
import { setClosedRate } from "@/app/rewards/actions";

// Inline editor a recruiter uses to record the closed rate (placement value) for one
// of their closures. Currency toggle (₹ / $) + amount + save.
export default function ClosedRateEditor({ id, value, currency }: { id: string; value: number | null; currency: string }) {
  const [val, setVal] = useState(value != null ? String(value) : "");
  const [cur, setCur] = useState(currency || "INR");
  const [savedVal, setSavedVal] = useState<number | null>(value);
  const [savedCur, setSavedCur] = useState(currency || "INR");
  const [busy, setBusy] = useState(false);
  const dirty = (val.trim() === "" ? null : Number(val)) !== savedVal || cur !== savedCur;

  async function save() {
    const num = val.trim() === "" ? null : Number(val);
    if (num != null && (isNaN(num) || num < 0)) { toast("Enter a valid amount", "error"); return; }
    setBusy(true);
    const res = await setClosedRate(id, num, cur);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Failed to save", "error"); return; }
    setSavedVal(num); setSavedCur(cur); toast("Closed rate saved", "success");
  }

  return (
    <div className="flex items-center gap-1.5">
      <select value={cur} onChange={(e) => setCur(e.target.value)} className="h-8 rounded-md border border-line bg-surface px-1 text-xs">
        <option value="INR">₹</option><option value="USD">$</option>
      </select>
      <input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" placeholder="0"
        className="h-8 w-24 rounded-md border border-line bg-surface px-2 text-sm" />
      <button onClick={save} disabled={busy || !dirty}
        className="h-8 rounded-md bg-brand-600 px-2.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40">
        {busy ? "…" : "Save"}
      </button>
    </div>
  );
}
