"use client";

import { useState } from "react";
import { upsertBadge, deleteBadge } from "@/app/admin/badges/actions";
import { Button, Card, Input, Label } from "@/components/ui";

type Badge = {
  id: string; code: string; name: string; description: string | null; icon: string | null;
  color: string | null; rule: string; threshold: number | null; period: string;
  is_repeatable: boolean; is_active: boolean; sort_order: number;
};

// Rules supported by the evaluation engine (lib/badges.ts). threshold meaning shown as a hint.
const RULES: { value: string; label: string; hint: string }[] = [
  { value: "submissions_total", label: "Total submissions ≥ N", hint: "all-time" },
  { value: "submissions_week", label: "Submissions this week ≥ N", hint: "per week" },
  { value: "submissions_month", label: "Submissions this month ≥ N", hint: "per month" },
  { value: "closures_total", label: "Total closures ≥ N", hint: "all-time" },
  { value: "closures_month", label: "Closures this month ≥ N", hint: "per month" },
  { value: "quality_month", label: "Data quality % ≥ N (min 5 subs)", hint: "per month, N=percent" },
  { value: "activity_days_week", label: "Activity days this week ≥ N", hint: "per week" },
  { value: "distinct_statuses", label: "Distinct pipeline stages used ≥ N", hint: "all-time" },
  { value: "top_submitter_month", label: "Top submitter (most this month)", hint: "comparative · no threshold" },
  { value: "recruiter_of_month", label: "Recruiter of the month (most closures)", hint: "comparative · no threshold" },
];
const PERIODS = ["once", "weekly", "monthly", "yearly"];

const blank: Badge = {
  id: "", code: "", name: "", description: "", icon: "🏅", color: "#6366f1",
  rule: "submissions_month", threshold: 5, period: "monthly", is_repeatable: true, is_active: true, sort_order: 100,
};

export default function BadgesManager({ badges }: { badges: Badge[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Badges &amp; achievements</h1>
        <p className="text-sm text-muted">Create, tune and enable badges. Awards are evaluated automatically as recruiters work and by the nightly sweep.</p>
      </div>

      <Card title="Add a badge"><BadgeForm initial={blank} isNew /></Card>

      <div className="space-y-3">
        {badges.map((b) => <BadgeRow key={b.id} b={b} />)}
        {badges.length === 0 && <p className="text-sm text-muted">No badges yet.</p>}
      </div>
    </div>
  );
}

function BadgeRow({ b }: { b: Badge }) {
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <Card className={b.is_active ? "" : "opacity-60"}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full text-xl" style={{ backgroundColor: (b.color ?? "#6366f1") + "33" }}>{b.icon ?? "🏅"}</span>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">{b.name}
              {!b.is_active && <span className="rounded bg-canvas px-1.5 text-[10px] uppercase text-muted">off</span>}
              {b.is_repeatable && <span className="rounded bg-brand-50 px-1.5 text-[10px] uppercase text-brand-700">repeatable</span>}
            </div>
            <div className="text-xs text-muted">{b.rule}{b.threshold != null ? ` ≥ ${b.threshold}` : ""} · {b.period}</div>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Edit"}</Button>
      </div>
      {open && <div className="mt-4 border-t border-line pt-4"><BadgeForm initial={b} onDeleted={() => setGone(true)} /></div>}
    </Card>
  );
}

function BadgeForm({ initial, isNew, onDeleted }: { initial: Badge; isNew?: boolean; onDeleted?: () => void }) {
  const [v, setV] = useState<Badge>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const comparative = v.rule === "top_submitter_month" || v.rule === "recruiter_of_month";

  async function save() {
    setBusy(true); setMsg(null);
    const res = await upsertBadge({
      id: isNew ? undefined : v.id, code: v.code, name: v.name, description: v.description ?? "",
      icon: v.icon ?? "", color: v.color ?? "#6366f1", rule: v.rule,
      threshold: comparative ? null : Number(v.threshold ?? 0), period: v.period,
      is_repeatable: v.is_repeatable, is_active: v.is_active, sort_order: Number(v.sort_order ?? 0),
    });
    setBusy(false);
    setMsg(res.ok ? "Saved." : "Error: " + res.error);
    if (res.ok && isNew) setV(blank);
  }
  async function remove() {
    if (!confirm(`Delete badge "${v.name}"? Existing awards are removed too.`)) return;
    const res = await deleteBadge(v.id);
    if (res.ok) onDeleted?.(); else setMsg("Error: " + res.error);
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div><Label>Name</Label><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
      <div><Label>Code</Label><Input value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="unique_key" /></div>
      <div><Label>Icon (emoji)</Label><Input value={v.icon ?? ""} onChange={(e) => setV({ ...v, icon: e.target.value })} /></div>
      <div><Label>Color</Label><Input type="color" value={v.color ?? "#6366f1"} onChange={(e) => setV({ ...v, color: e.target.value })} /></div>

      <div className="col-span-2 md:col-span-4"><Label>Description</Label><Input value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>

      <div className="col-span-2"><Label>Rule</Label>
        <select className="h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm" value={v.rule} onChange={(e) => setV({ ...v, rule: e.target.value })}>
          {RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <p className="mt-1 text-[11px] text-muted">{RULES.find((r) => r.value === v.rule)?.hint}</p>
      </div>
      <div><Label>Threshold (N)</Label><Input type="number" disabled={comparative} value={comparative ? "" : (v.threshold ?? 0)} onChange={(e) => setV({ ...v, threshold: Number(e.target.value) })} /></div>
      <div><Label>Period</Label>
        <select className="h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm" value={v.period} onChange={(e) => setV({ ...v, period: e.target.value })}>
          {PERIODS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.is_repeatable} onChange={(e) => setV({ ...v, is_repeatable: e.target.checked })} /> Repeatable</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} /> Active</label>
      <div><Label>Sort order</Label><Input type="number" value={v.sort_order} onChange={(e) => setV({ ...v, sort_order: Number(e.target.value) })} /></div>

      <div className="col-span-2 mt-1 flex items-center gap-3 md:col-span-4">
        <Button disabled={busy || !v.name.trim() || !v.code.trim()} onClick={save}>{isNew ? "Create badge" : "Save"}</Button>
        {!isNew && <Button variant="danger" onClick={remove}>Delete</Button>}
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </div>
  );
}
