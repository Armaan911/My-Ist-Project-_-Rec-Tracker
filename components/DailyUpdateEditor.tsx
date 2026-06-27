"use client";

import { useMemo, useRef, useState } from "react";
import {
  Plus, Minus, Trash2, Check, CalendarDays, Lock, Sparkles, RotateCcw,
  Search, FileText, Send, Briefcase, FileSignature, CalendarClock, UserCheck, Gift,
  Activity, Phone, Mail, Users, CheckCircle, ClipboardList, Target, Trophy, Star, Zap, ThumbsUp, Flame, Award, Clock,
} from "lucide-react";
import type { AllocatedReq, DailyItem, DailyItemInput, DailyMetric } from "@/lib/types";
import { EmptyState } from "@/components/Illustration";
import { prettyDate } from "@/lib/dates";

type SaveResult = { ok: boolean; error?: string; queued?: boolean };
type Row = { key: string; requirement_id: string; values: Record<string, number>; saved: boolean };

const ICONS: Record<string, any> = {
  search: Search, "file-text": FileText, send: Send, briefcase: Briefcase, "file-signature": FileSignature,
  "calendar-clock": CalendarClock, "user-check": UserCheck, gift: Gift, activity: Activity, phone: Phone,
  mail: Mail, users: Users, "check-circle": CheckCircle, "clipboard-list": ClipboardList, target: Target,
  trophy: Trophy, star: Star, zap: Zap, "thumbs-up": ThumbsUp, flame: Flame, award: Award, clock: Clock,
};
const iconFor = (k: string) => ICONS[k] ?? Activity;

let _k = 0;
const nextKey = () => `row-${_k++}-${Math.random().toString(36).slice(2, 7)}`;

function itemsToRows(items: DailyItem[]): Row[] {
  return items.map((i) => ({ key: nextKey(), requirement_id: i.requirement_id, values: { ...i.values }, saved: true }));
}
function buzz() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) { try { navigator.vibrate(4); } catch { /* unsupported */ } }
}

/* ---------- input styles ---------- */

// Drag-to-fill bar (pointer + keyboard + haptics).
function DragMeter({ value, soft, color, disabled, onChange }: { value: number; soft: number; color: string; disabled?: boolean; onChange: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(value);
  const [grab, setGrab] = useState(false);
  const eff = Math.max(soft, value);
  const pct = eff === 0 ? 0 : Math.min(100, (value / eff) * 100);
  const emit = (v: number) => { const nv = Math.max(0, Math.round(v)); if (nv !== last.current) { last.current = nv; buzz(); } onChange(nv); };
  const fromX = (clientX: number) => { const el = ref.current; if (!el) return; const r = el.getBoundingClientRect(); emit(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * eff); };
  function onKey(e: React.KeyboardEvent) {
    if (disabled) return; let v = value;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") v += 1; else if (e.key === "ArrowLeft" || e.key === "ArrowDown") v -= 1;
    else if (e.key === "PageUp") v += 5; else if (e.key === "PageDown") v -= 5; else if (e.key === "Home") v = 0; else if (e.key === "End") v = eff; else return;
    e.preventDefault(); emit(v);
  }
  return (
    <div ref={ref} role="slider" aria-valuenow={value} aria-valuemin={0} aria-valuemax={eff} aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
      onPointerDown={(e) => { if (disabled) return; setGrab(true); e.currentTarget.setPointerCapture?.(e.pointerId); fromX(e.clientX); }}
      onPointerMove={(e) => { if (grab && !disabled) fromX(e.clientX); }}
      onPointerUp={(e) => { setGrab(false); e.currentTarget.releasePointerCapture?.(e.pointerId); }}
      onPointerCancel={() => setGrab(false)} onKeyDown={onKey}
      className={`relative h-9 w-full touch-none select-none rounded-full bg-canvas ring-1 ring-inset ring-line transition-shadow ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${grab ? "shadow-pop" : ""}`}>
      <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150 ease-out motion-reduce:transition-none" style={{ width: `${Math.max(pct, value > 0 ? 8 : 0)}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }} />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-3 opacity-40">{Array.from({ length: 9 }).map((_, i) => <span key={i} className="h-1 w-px rounded bg-line" />)}</div>
      <div className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-150 ease-out motion-reduce:transition-none" style={{ left: `${pct}%` }}>
        <span className="block rounded-full border-2 bg-surface transition-all duration-150 motion-reduce:transition-none" style={{ width: grab ? 26 : 20, height: grab ? 26 : 20, borderColor: color, boxShadow: grab ? `0 0 0 6px ${color}22, 0 4px 10px ${color}55` : `0 1px 3px ${color}44` }} />
      </div>
    </div>
  );
}

function MiniBtn({ onClick, disabled, color, children, label }: { onClick: () => void; disabled?: boolean; color?: string; children: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={() => { if (!disabled) { buzz(); onClick(); } }} disabled={disabled} aria-label={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-canvas active:scale-95 disabled:opacity-40 motion-reduce:active:scale-100"
      style={color ? { color } : undefined}>{children}</button>
  );
}

// Stepper: a bold − / + pair (value lives in the header). The "simple, fast" style.
function Stepper({ value, color, disabled, onChange }: { value: number; color: string; disabled?: boolean; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <MiniBtn label="decrease" color={color} disabled={disabled || value <= 0} onClick={() => onChange(value - 1)}><Minus size={15} /></MiniBtn>
      <div className="h-9 flex-1 rounded-full bg-canvas ring-1 ring-inset ring-line" />
      <MiniBtn label="increase" color={color} disabled={disabled} onClick={() => onChange(value + 1)}><Plus size={15} /></MiniBtn>
    </div>
  );
}

// Chips: quick-add buttons for things that jump in bigger steps (submissions).
function Chips({ value, color, disabled, onChange }: { value: number; color: string; disabled?: boolean; onChange: (n: number) => void }) {
  const add = (d: number) => { if (disabled) return; buzz(); onChange(Math.max(0, value + d)); };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" disabled={disabled || value <= 0} onClick={() => add(-1)} className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-muted hover:bg-canvas active:scale-95 disabled:opacity-40" aria-label="decrease"><Minus size={14} /></button>
      {[1, 5, 10].map((n) => (
        <button key={n} type="button" disabled={disabled} onClick={() => add(n)}
          className="h-8 rounded-lg px-3 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-40" style={{ background: color }}>+{n}</button>
      ))}
      {value > 0 && <button type="button" disabled={disabled} onClick={() => { buzz(); onChange(0); }} className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-muted hover:bg-canvas" aria-label="reset" title="Reset"><RotateCcw size={13} /></button>}
    </div>
  );
}

// Tally: tap the pad to +1, rendered as classic five-bar tally groups. Playful & tactile.
function Tally({ value, color, disabled, onChange }: { value: number; color: string; disabled?: boolean; onChange: (n: number) => void }) {
  const full = Math.floor(value / 5);
  const rem = value % 5;
  const groups: number[] = [...Array(full).fill(5), ...(rem ? [rem] : [])];
  return (
    <div className="flex items-center gap-2">
      <button type="button" disabled={disabled} aria-label="add one"
        onClick={() => { if (disabled) return; buzz(); onChange(value + 1); }}
        className="flex h-12 flex-1 items-center gap-2 overflow-x-auto rounded-xl border-2 border-dashed bg-canvas px-3 transition active:scale-[0.99] disabled:opacity-60"
        style={{ borderColor: `${color}55` }}>
        {value === 0 ? (
          <span className="text-xs font-medium" style={{ color }}>Tap to count +1</span>
        ) : (
          groups.map((g, gi) => (
            <span key={gi} className="relative flex h-6 shrink-0 items-end gap-1">
              {Array.from({ length: Math.min(g, 4) }).map((_, i) => <span key={i} className="h-6 w-[3px] rounded-sm" style={{ background: color }} />)}
              {g === 5 && <span className="absolute left-[-2px] top-1/2 h-[3px] w-7 -translate-y-1/2 rotate-[-20deg] rounded-sm" style={{ background: color }} />}
            </span>
          ))
        )}
      </button>
      <MiniBtn label="decrease" color={color} disabled={disabled || value <= 0} onClick={() => onChange(value - 1)}><Minus size={15} /></MiniBtn>
    </div>
  );
}

function MetricControl({ metric, value, disabled, onChange }: { metric: DailyMetric; value: number; disabled?: boolean; onChange: (n: number) => void }) {
  const common = { value, color: metric.color, disabled, onChange };
  switch (metric.input_style) {
    case "stepper": return <Stepper {...common} />;
    case "chips": return <Chips {...common} />;
    case "tally": return <Tally {...common} />;
    case "slider":
    default:
      return (
        <div className="flex items-center gap-2">
          <MiniBtn label="decrease" color={metric.color} disabled={disabled || value <= 0} onClick={() => onChange(value - 1)}><Minus size={14} /></MiniBtn>
          <DragMeter value={value} soft={metric.soft_max} color={metric.color} disabled={disabled} onChange={onChange} />
          <MiniBtn label="increase" color={metric.color} disabled={disabled} onClick={() => onChange(value + 1)}><Plus size={14} /></MiniBtn>
        </div>
      );
  }
}

/* ---------- main editor ---------- */

export default function DailyUpdateEditor({
  reqs, metrics, date: initialDate, initialItems, locked = false, allowDateChange = false, greeting, save, loadDate,
}: {
  reqs: AllocatedReq[];
  metrics: DailyMetric[];
  date: string;
  initialItems: DailyItem[];
  locked?: boolean;
  allowDateChange?: boolean;
  greeting?: string;
  save: (date: string, items: DailyItemInput[]) => Promise<SaveResult>;
  loadDate?: (date: string) => Promise<{ items: DailyItem[]; locked: boolean }>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(initialDate);
  const [isLocked, setIsLocked] = useState(locked);
  const [rows, setRows] = useState<Row[]>(() => itemsToRows(initialItems));
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);

  const reqById = useMemo(() => new Map(reqs.map((r) => [r.id, r])), [reqs]);
  const usedIds = new Set(rows.map((r) => r.requirement_id));
  const available = reqs.filter((r) => !usedIds.has(r.id));

  const val = (row: Row, id: string) => row.values[id] ?? 0;
  const totals = metrics.reduce((acc, m) => { acc[m.id] = rows.reduce((n, r) => n + val(r, m.id), 0); return acc; }, {} as Record<string, number>);
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);
  const maxTotal = Math.max(1, ...Object.values(totals));

  function touch() { setSaved(false); setMsg(null); }
  function addRow(reqId: string) { if (!reqId) return; setRows((rs) => [...rs, { key: nextKey(), requirement_id: reqId, values: {}, saved: false }]); setPick(""); touch(); }
  function patchRow(key: string, metricId: string, v: number) { setRows((rs) => rs.map((r) => (r.key === key ? { ...r, values: { ...r.values, [metricId]: Math.max(0, v) }, saved: false } : r))); setSaved(false); }
  function removeRow(key: string) { setRows((rs) => rs.filter((r) => r.key !== key)); touch(); }

  async function changeDate(d: string) {
    if (!loadDate) { setDate(d); return; }
    setSwitching(true); setMsg(null); setSaved(false);
    try { const res = await loadDate(d); setDate(d); setIsLocked(res.locked); setRows(itemsToRows(res.items)); }
    finally { setSwitching(false); }
  }

  async function submit() {
    const payload: DailyItemInput[] = rows.map((r) => ({ requirement_id: r.requirement_id, values: r.values }));
    if (payload.length === 0) { setMsg({ tone: "err", text: "Add a requirement and log a few numbers first." }); return; }
    setSaving(true); setMsg(null);
    const res = await save(date, payload);
    setSaving(false);
    if (!res.ok) { setMsg({ tone: "err", text: res.error || "Couldn't save — try again." }); return; }
    if (res.queued) { setMsg({ tone: "info", text: "That day is locked — your changes went to an admin for approval." }); return; }
    setRows((rs) => rs.map((r) => ({ ...r, saved: true }))); setSaved(true);
    setMsg({ tone: "ok", text: "Logged. Nice work today." });
  }

  if (reqs.length === 0) {
    return (
      <EmptyState illustration="pipeline" title="No requirements assigned yet"
        hint="The moment a manager allocates a requirement to you, it shows up here to log against." />
    );
  }
  if (metrics.length === 0) {
    return <EmptyState illustration="pipeline" title="No daily metrics set up yet" hint="An admin can add them under Admin → Daily metrics." />;
  }

  const pretty = (d: string) => prettyDate(d, { weekday: "short" });
  const cheer = grand === 0
    ? "Drag, tap, or count — your numbers fill in as you go."
    : metrics.filter((m) => totals[m.id] > 0).map((m) => `${totals[m.id]} ${m.label.toLowerCase()}`).slice(0, 4).join(" · ") + " — momentum looks good.";

  return (
    <div className="space-y-5">
      {/* header band */}
      <div className="overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            {greeting && <h2 className="font-display text-lg font-bold tracking-tight">{greeting}</h2>}
            <p className="mt-0.5 flex items-center gap-2 text-sm text-muted">
              {date === today ? "Logging today" : `Logging ${pretty(date)}`}
              {isLocked && <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-xs text-warning-600"><Lock size={11} /> past day · edits need approval</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white tabular shadow-card"><Sparkles size={14} /> {grand} action{grand === 1 ? "" : "s"} today</span>
            {allowDateChange && (
              <label className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
                <CalendarDays size={15} className="text-muted" />
                <input type="date" value={date} max={today} onChange={(e) => changeDate(e.target.value)} className="bg-transparent text-sm outline-none" />
              </label>
            )}
          </div>
        </div>
        <div className="border-t border-brand-100/70 bg-surface/60 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wide text-muted">Today&apos;s effort</span><span className="truncate text-xs text-muted">{cheer}</span></div>
          <div className="space-y-1.5">
            {metrics.map((m) => {
              const v = totals[m.id];
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 truncate text-xs font-medium text-ink" title={m.label}>{m.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${(v / maxTotal) * 100}%`, background: `linear-gradient(90deg, ${m.color}bb, ${m.color})` }} /></div>
                  <span className="w-7 shrink-0 text-right font-mono text-sm font-semibold tabular" style={{ color: v > 0 ? m.color : undefined }}>{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* add a requirement */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink">Requirement worked on</span>
        <select disabled={switching || available.length === 0} className="h-10 min-w-[220px] flex-1 rounded-xl border border-line bg-surface px-3 text-sm disabled:opacity-60" value={pick} onChange={(e) => addRow(e.target.value)}>
          <option value="">{available.length === 0 ? "Every assigned requirement is added" : "Add a requirement to log…"}</option>
          {available.map((r) => <option key={r.id} value={r.id}>{r.title}{r.job_code ? ` · ${r.job_code}` : ""}{r.division_name ? ` (${r.division_name})` : ""}</option>)}
        </select>
      </div>

      {/* per-requirement cards */}
      {switching ? (
        <div className="py-10 text-center text-sm text-muted">Loading that day…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">Pick a requirement above and start logging — it takes seconds.</div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const req = reqById.get(row.requirement_id);
            const rowTotal = metrics.reduce((n, m) => n + val(row, m.id), 0);
            return (
              <div key={row.key} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                <div className="flex items-start justify-between gap-3 border-b border-line bg-canvas/40 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-ink">{req?.title ?? "Requirement"}</span>
                      {req?.job_code && <span className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-xs font-medium text-muted ring-1 ring-line">{req.job_code}</span>}
                      {row.saved ? <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-600"><Check size={11} /> saved</span>
                        : rowTotal > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">{rowTotal} logged</span> : null}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">{[req?.client_name, req?.division_name].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <button onClick={() => removeRow(row.key)} className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger-50 hover:text-danger-600" aria-label="Remove from today's log" title="Remove from today's log"><Trash2 size={15} /></button>
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 p-4 lg:grid-cols-2">
                  {metrics.map((m) => {
                    const Icon = iconFor(m.icon);
                    const v = val(row, m.id);
                    return (
                      <div key={m.id}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ backgroundColor: `${m.color}14`, color: m.color }}><Icon size={15} /></span>
                            <span className="text-sm font-medium text-ink">{m.label}</span>
                          </span>
                          <span className="font-mono text-xl font-bold tabular leading-none" style={{ color: v > 0 ? m.color : "#9a9aa6" }}>{v}</span>
                        </div>
                        <MetricControl metric={m} value={v} disabled={switching} onChange={(n) => patchRow(row.key, m.id, n)} />
                        {m.hint && <div className="mt-1 text-[11px] leading-tight text-muted">{m.hint}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* actions */}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-pop backdrop-blur">
        <button onClick={submit} disabled={saving || switching || rows.length === 0}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-white shadow-card transition-all active:scale-[0.98] disabled:opacity-50 motion-reduce:active:scale-100 ${saved ? "bg-success-600" : "bg-brand-600 hover:bg-brand-700"}`}>
          {saving ? "Saving…" : saved ? <><Check size={16} /> Saved</> : isLocked ? "Send for approval" : grand > 0 ? "Save today's update" : "Save"}
        </button>
        {msg && <span className={`text-sm ${msg.tone === "ok" ? "font-bold text-success-600" : msg.tone === "err" ? "font-medium text-danger-600" : "font-medium text-warning-600"}`}>{msg.text}</span>}
        {!msg && grand > 0 && !saved && <span className="text-sm text-muted">{grand} action{grand === 1 ? "" : "s"} ready to save.</span>}
      </div>
    </div>
  );
}
