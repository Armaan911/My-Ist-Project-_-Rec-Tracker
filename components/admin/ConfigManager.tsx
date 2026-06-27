"use client";
import { useState } from "react";
import { upsertStatus, updateMedalTier, updateFallingBehind, updateLeaderboardWeights } from "@/app/admin/config/actions";
import { Button, Card, Input, Label } from "@/components/ui";

type Status = { id: string; code: string; label: string; sort_order: number; counts_as_closure: boolean; is_rejection: boolean; is_terminal: boolean; is_active: boolean };
type Tier = { id: string; name: string; min_closures: number; color: string | null };

export default function ConfigManager({ statuses, tiers, falling, weights }: { statuses: Status[]; tiers: Tier[]; falling: { min_activity_days_per_week: number; min_submissions_per_week: number }; weights: { submissions: number; closures: number; active_days: number } }) {
  return (
    <div className="space-y-6">
      <StatusesCard statuses={statuses} />
      <MedalsCard tiers={tiers} />
      <FallingCard falling={falling} />
      <WeightsCard weights={weights} />
    </div>
  );
}

function StatusesCard({ statuses }: { statuses: Status[] }) {
  const [neu, setNeu] = useState({ code: "", label: "", sort_order: "200" });
  const [msg, setMsg] = useState<string | null>(null);
  async function add() {
    if (!neu.code.trim() || !neu.label.trim()) { setMsg("Code and label are required."); return; }
    const res = await upsertStatus({ code: neu.code.trim(), label: neu.label.trim(), sort_order: Number(neu.sort_order), counts_as_closure: false, is_rejection: false, is_terminal: false, is_active: true });
    setMsg(res.ok ? "Stage added." : "Error: " + res.error); if (res.ok) setNeu({ code: "", label: "", sort_order: "200" });
  }
  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold">Pipeline stages</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Label</th><th>Order</th><th>Closure?</th><th>Rejection?</th><th>Terminal?</th><th>Active?</th><th></th></tr></thead>
          <tbody>{statuses.map((s) => <StatusRow key={s.id} s={s} />)}</tbody>
        </table>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div><Label>New code <span className="text-danger-600">*</span></Label><Input value={neu.code} onChange={(e) => setNeu({ ...neu, code: e.target.value })} placeholder="offer_made" /></div>
        <div><Label>Label <span className="text-danger-600">*</span></Label><Input value={neu.label} onChange={(e) => setNeu({ ...neu, label: e.target.value })} placeholder="Offer Made" /></div>
        <div><Label>Sort order</Label><Input type="number" value={neu.sort_order} onChange={(e) => setNeu({ ...neu, sort_order: e.target.value })} /></div>
      </div>
      <div className="mt-3 flex items-center gap-3"><Button disabled={!neu.code.trim() || !neu.label.trim()} onClick={add}>Add stage</Button>{msg && <span className="text-sm text-slate-600">{msg}</span>}</div>
    </Card>
  );
}

function StatusRow({ s }: { s: Status }) {
  const [v, setV] = useState(s);
  const [saved, setSaved] = useState(false);
  async function save() { const res = await upsertStatus(v); setSaved(res.ok); }
  const chk = (k: keyof Status) => (
    <input type="checkbox" checked={v[k] as boolean} onChange={(e) => { setV({ ...v, [k]: e.target.checked }); setSaved(false); }} />
  );
  return (
    <tr className="border-t border-slate-100">
      <td className="py-2"><input className="rounded border px-1 py-0.5" value={v.label} onChange={(e) => { setV({ ...v, label: e.target.value }); setSaved(false); }} /></td>
      <td><input type="number" className="w-16 rounded border px-1 py-0.5" value={v.sort_order} onChange={(e) => { setV({ ...v, sort_order: Number(e.target.value) }); setSaved(false); }} /></td>
      <td>{chk("counts_as_closure")}</td><td>{chk("is_rejection")}</td><td>{chk("is_terminal")}</td><td>{chk("is_active")}</td>
      <td><button onClick={save} className="text-xs underline">{saved ? "saved" : "save"}</button></td>
    </tr>
  );
}

function MedalsCard({ tiers }: { tiers: Tier[] }) {
  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold">Medal tiers (by all-time closures)</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{tiers.sort((a, b) => a.min_closures - b.min_closures).map((t) => <TierRow key={t.id} t={t} />)}</div>
    </Card>
  );
}
function TierRow({ t }: { t: Tier }) {
  const [v, setV] = useState({ name: t.name, min_closures: t.min_closures.toString(), color: t.color ?? "#cccccc" });
  const [saved, setSaved] = useState(false);
  async function save() { const res = await updateMedalTier({ id: t.id, name: v.name, min_closures: Number(v.min_closures), color: v.color }); setSaved(res.ok); }
  return (
    <div className="flex items-end gap-2 rounded-lg border border-slate-200 p-3">
      <div className="flex-1"><Label>Name</Label><Input value={v.name} onChange={(e) => { setV({ ...v, name: e.target.value }); setSaved(false); }} /></div>
      <div className="w-24"><Label>Min closures</Label><Input type="number" value={v.min_closures} onChange={(e) => { setV({ ...v, min_closures: e.target.value }); setSaved(false); }} /></div>
      <div className="w-20"><Label>Color</Label><input type="color" className="h-9 w-full rounded border" value={v.color} onChange={(e) => { setV({ ...v, color: e.target.value }); setSaved(false); }} /></div>
      <button onClick={save} className="pb-2 text-xs underline">{saved ? "saved" : "save"}</button>
    </div>
  );
}

function FallingCard({ falling }: { falling: { min_activity_days_per_week: number; min_submissions_per_week: number } }) {
  const [v, setV] = useState({ days: falling.min_activity_days_per_week.toString(), subs: falling.min_submissions_per_week.toString() });
  const [msg, setMsg] = useState<string | null>(null);
  async function save() {
    const res = await updateFallingBehind({ min_activity_days_per_week: Number(v.days), min_submissions_per_week: Number(v.subs) });
    setMsg(res.ok ? "Saved." : "Error: " + res.error);
  }
  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold">“Falling behind” rule (weekly)</h2>
      <div className="grid grid-cols-2 gap-3 md:w-2/3">
        <div><Label>Min active days / week</Label><Input type="number" value={v.days} onChange={(e) => setV({ ...v, days: e.target.value })} /></div>
        <div><Label>Min submissions / week</Label><Input type="number" value={v.subs} onChange={(e) => setV({ ...v, subs: e.target.value })} /></div>
      </div>
      <div className="mt-3 flex items-center gap-3"><Button onClick={save}>Save rule</Button>{msg && <span className="text-sm text-slate-600">{msg}</span>}</div>
    </Card>
  );
}

function WeightsCard({ weights }: { weights: { submissions: number; closures: number; active_days: number } }) {
  const [v, setV] = useState({ s: String(weights.submissions), c: String(weights.closures), a: String(weights.active_days) });
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true); setMsg(null);
    const res = await updateLeaderboardWeights({ submissions: Number(v.s), closures: Number(v.c), active_days: Number(v.a) });
    setSaving(false); setMsg(res.ok ? "Saved." : "Error: " + res.error);
  }
  return (
    <Card title="Leaderboard score weights">
      <p className="mb-3 text-sm text-muted">How the performance ranking is scored: <span className="font-mono">submissions×{v.s || 0} + closures×{v.c || 0} + active days×{v.a || 0}</span>. Tune these to reward what matters most.</p>
      <div className="flex flex-wrap items-end gap-3">
        <div><Label>Submissions</Label><Input type="number" min={0} value={v.s} onChange={(e) => setV({ ...v, s: e.target.value })} className="w-28" /></div>
        <div><Label>Closures</Label><Input type="number" min={0} value={v.c} onChange={(e) => setV({ ...v, c: e.target.value })} className="w-28" /></div>
        <div><Label>Active days</Label><Input type="number" min={0} value={v.a} onChange={(e) => setV({ ...v, a: e.target.value })} className="w-28" /></div>
        <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save weights"}</Button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </Card>
  );
}
