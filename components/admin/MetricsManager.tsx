"use client";
import { useState } from "react";
import {
  Plus, Trash2, Pencil, ChevronUp, ChevronDown, GripVertical,
  Search, FileText, Send, Briefcase, FileSignature, CalendarClock, UserCheck, Gift,
  Activity, Phone, Mail, Users, CheckCircle, ClipboardList, Target, Trophy, Star, Zap, ThumbsUp, Flame, Award, Clock,
} from "lucide-react";
import { createMetric, updateMetric, deleteMetric, reorderMetric } from "@/app/admin/metrics/actions";
import { Badge, Button, Card, Input, Label, Modal, Spinner } from "@/components/ui";

type Metric = { id: string; key: string; label: string; hint: string | null; color: string; icon: string; input_style: string; soft_max: number; sort_order: number; is_active: boolean };

const ICONS: Record<string, any> = {
  search: Search, "file-text": FileText, send: Send, briefcase: Briefcase, "file-signature": FileSignature,
  "calendar-clock": CalendarClock, "user-check": UserCheck, gift: Gift, activity: Activity, phone: Phone,
  mail: Mail, users: Users, "check-circle": CheckCircle, "clipboard-list": ClipboardList, target: Target,
  trophy: Trophy, star: Star, zap: Zap, "thumbs-up": ThumbsUp, flame: Flame, award: Award, clock: Clock,
};
const ICON_KEYS = Object.keys(ICONS);
const COLORS = ["#068AD3", "#6366F1", "#0EA5E9", "#8B5CF6", "#EC4899", "#F59E0B", "#0E9F6E", "#14B8A6", "#EF4444", "#D946EF", "#22C55E", "#64748B"];
const STYLES: { value: string; label: string; desc: string }[] = [
  { value: "slider", label: "Slider", desc: "Drag a bar to set the number" },
  { value: "stepper", label: "Stepper", desc: "Simple − / + buttons" },
  { value: "chips", label: "Quick chips", desc: "+1 / +5 / +10 taps — good for submissions" },
  { value: "tally", label: "Tally", desc: "Tap to count up, tally-mark style" },
];
const iconFor = (k: string) => ICONS[k] ?? Activity;

export default function MetricsManager({ metrics }: { metrics: Metric[] }) {
  const [editing, setEditing] = useState<Metric | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Daily metrics</h1>
        <p className="text-sm text-muted">These are the things recruiters log each day. Add, edit, reorder or remove them — changes apply to everyone&apos;s form right away.</p>
      </div>

      <CreateCard onMsg={setMsg} />
      {msg && <p className="text-sm text-muted">{msg}</p>}

      <Card title="Current metrics" action={<span className="text-xs text-muted">{metrics.length} total · {metrics.filter((m) => m.is_active).length} active</span>}>
        {metrics.length === 0 ? (
          <p className="py-4 text-sm text-muted">No metrics yet — add your first one above.</p>
        ) : (
          <div className="space-y-2">
            {metrics.map((m, i) => {
              const Icon = iconFor(m.icon);
              return (
                <div key={m.id} className={`flex flex-wrap items-center gap-3 rounded-xl border border-line p-3 ${m.is_active ? "" : "opacity-60"}`}>
                  <div className="flex flex-col">
                    <button disabled={i === 0} onClick={() => reorderMetric(m.id, "up")} className="text-muted hover:text-ink disabled:opacity-30" aria-label="Move up"><ChevronUp size={15} /></button>
                    <button disabled={i === metrics.length - 1} onClick={() => reorderMetric(m.id, "down")} className="text-muted hover:text-ink disabled:opacity-30" aria-label="Move down"><ChevronDown size={15} /></button>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ backgroundColor: `${m.color}18`, color: m.color }}><Icon size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{m.label}</span>
                      <Badge tone="neutral">{STYLES.find((s) => s.value === m.input_style)?.label ?? m.input_style}</Badge>
                      {!m.is_active && <Badge tone="danger">Hidden</Badge>}
                    </div>
                    <div className="text-xs text-muted">{m.hint || "—"} · <span className="font-mono">{m.key}</span></div>
                  </div>
                  <button onClick={() => setEditing(m)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-canvas hover:text-ink"><Pencil size={13} /> Edit</button>
                  <DeleteButton metric={m} onMsg={setMsg} />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {editing && <EditModal metric={editing} onClose={() => setEditing(null)} onMsg={setMsg} />}
    </div>
  );
}

function DeleteButton({ metric, onMsg }: { metric: Metric; onMsg: (s: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!confirm(`Delete "${metric.label}"? This also removes every value recruiters have logged for it. To just hide it instead, edit and turn it off.`)) return;
    setBusy(true);
    const res = await deleteMetric(metric.id);
    setBusy(false);
    onMsg(res.ok ? `Deleted "${metric.label}".` : `Error: ${res.error}`);
  }
  return <Button size="sm" variant="danger" disabled={busy} onClick={del}><Trash2 size={13} /> Delete</Button>;
}

function IconPicker({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ICON_KEYS.map((k) => {
        const Icon = ICONS[k];
        const on = value === k;
        return (
          <button key={k} type="button" onClick={() => onChange(k)} aria-label={k}
            className={`grid h-8 w-8 place-items-center rounded-lg border transition ${on ? "border-2" : "border-line hover:bg-canvas"}`}
            style={on ? { borderColor: color, backgroundColor: `${color}14`, color } : undefined}>
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLORS.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={c}
          className={`h-7 w-7 rounded-full transition ${value === c ? "ring-2 ring-offset-2" : "hover:scale-110"}`}
          style={{ background: c, boxShadow: value === c ? `0 0 0 2px ${c}` : undefined }} />
      ))}
    </div>
  );
}

function StylePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {STYLES.map((s) => (
        <button key={s.value} type="button" onClick={() => onChange(s.value)}
          className={`rounded-xl border p-2.5 text-left transition ${value === s.value ? "border-brand-600 bg-brand-50" : "border-line hover:bg-canvas"}`}>
          <div className="text-sm font-medium">{s.label}</div>
          <div className="text-[11px] leading-tight text-muted">{s.desc}</div>
        </button>
      ))}
    </div>
  );
}

function MetricFields({ f, set }: { f: any; set: (patch: any) => void }) {
  const Icon = iconFor(f.icon);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas/50 p-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg" style={{ backgroundColor: `${f.color}18`, color: f.color }}><Icon size={19} /></span>
        <div><div className="text-sm font-semibold">{f.label || "New metric"}</div><div className="text-xs text-muted">Live preview</div></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Name</Label><Input value={f.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Client submissions" /></div>
        <div><Label>Helper text</Label><Input value={f.hint} onChange={(e) => set({ hint: e.target.value })} placeholder="e.g. Submitted to the client" /></div>
      </div>
      <div><Label>Input style</Label><StylePicker value={f.input_style} onChange={(v) => set({ input_style: v })} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Colour</Label><ColorPicker value={f.color} onChange={(v) => set({ color: v })} /></div>
        {f.input_style === "slider" && <div><Label>Slider scale (typical max)</Label><Input type="number" min={1} value={f.soft_max} onChange={(e) => set({ soft_max: Number(e.target.value) })} /></div>}
      </div>
      <div><Label>Icon</Label><IconPicker value={f.icon} onChange={(v) => set({ icon: v })} color={f.color} /></div>
    </div>
  );
}

function CreateCard({ onMsg }: { onMsg: (s: string) => void }) {
  const blank = { label: "", hint: "", color: COLORS[0], icon: "activity", input_style: "slider", soft_max: 20 };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const set = (patch: any) => setF((p) => ({ ...p, ...patch }));

  async function add() {
    if (!f.label.trim()) { onMsg("Give the metric a name first."); return; }
    setSaving(true);
    const res = await createMetric(f);
    setSaving(false);
    if (res.ok) { setF(blank); onMsg(`Added "${f.label}".`); } else onMsg(`Error: ${res.error}`);
  }

  return (
    <Card title="New daily metric">
      <MetricFields f={f} set={set} />
      <div className="mt-4"><Button disabled={saving || !f.label.trim()} onClick={add}>{saving ? <><Spinner /> Adding…</> : <><Plus size={16} /> Add metric</>}</Button></div>
    </Card>
  );
}

function EditModal({ metric, onClose, onMsg }: { metric: Metric; onClose: () => void; onMsg: (s: string) => void }) {
  const [f, setF] = useState({ label: metric.label, hint: metric.hint ?? "", color: metric.color, icon: metric.icon, input_style: metric.input_style, soft_max: metric.soft_max, is_active: metric.is_active });
  const [saving, setSaving] = useState(false);
  const set = (patch: any) => setF((p) => ({ ...p, ...patch }));

  async function save() {
    setSaving(true);
    const res = await updateMetric({ id: metric.id, ...f });
    setSaving(false);
    if (res.ok) { onMsg(`Saved "${f.label}".`); onClose(); } else onMsg(`Error: ${res.error}`);
  }

  return (
    <Modal open onClose={onClose} wide title={`Edit ${metric.label}`} description={`Key: ${metric.key} (permanent)`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={save}>{saving ? <><Spinner /> Saving…</> : "Save changes"}</Button></>}>
      <MetricFields f={f} set={set} />
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.is_active} onChange={(e) => set({ is_active: e.target.checked })} className="h-4 w-4 rounded border-line" />
        Show this metric on the daily form
      </label>
    </Modal>
  );
}
