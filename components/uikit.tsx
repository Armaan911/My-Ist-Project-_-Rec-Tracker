"use client";
import { ReactNode, useEffect, useState } from "react";

/* ---------------- Segmented control (animated thumb) ---------------- */
export function SegmentedControl<T extends string>({ value, onChange, options, size = "md" }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: "sm" | "md";
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const pad = size === "sm" ? "p-0.5" : "p-1";
  const h = size === "sm" ? "h-7 text-xs" : "h-9 text-sm";
  return (
    <div className={`relative inline-grid rounded-xl bg-canvas ${pad}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      <span
        className="absolute top-1 bottom-1 rounded-lg bg-surface shadow-xs transition-transform duration-300 ease-spring"
        style={{ width: `calc((100% - ${size === "sm" ? "0.25rem" : "0.5rem"}) / ${options.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`relative z-10 ${h} rounded-lg px-3 font-medium transition-colors ${o.value === value ? "text-ink" : "text-muted hover:text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Sparkline ---------------- */
export function Sparkline({ data, color = "#068AD3", width = 120, height = 34, fill = true }: { data: number[]; color?: string; width?: number; height?: number; fill?: boolean }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...data), min = Math.min(...data), span = max - min || 1;
  const pts = data.map((d, i) => [(i / (data.length - 1)) * width, height - 4 - ((d - min) / span) * (height - 8)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const id = `sg-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.22" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

/* ---------------- Stat card ---------------- */
export function StatCard({ icon, label, value, delta, hint, spark, sparkColor, accent = false, onClick }: {
  icon?: ReactNode; label: string; value: ReactNode; delta?: { value: number; dir: "up" | "down" } | null;
  hint?: ReactNode; spark?: number[]; sparkColor?: string; accent?: boolean; onClick?: () => void;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-2xl border border-line bg-surface p-4 text-left elevate ${accent ? "accent-top" : ""} ${onClick ? "elevate-hover cursor-pointer" : ""}`}>
      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-brand-500/[0.06] blur-2xl transition-opacity group-hover:bg-brand-500/[0.10]" />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2 text-muted">
          {icon && <span className="grid h-8 w-8 place-items-center rounded-lg brand-mark text-white shadow-[0_2px_6px_rgba(91,91,214,0.30)]">{icon}</span>}
          <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        </div>
        {delta && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${delta.dir === "up" ? "bg-success-50 text-success-600" : "bg-danger-50 text-danger-600"}`}>
            {delta.dir === "up" ? "▲" : "▼"} {Math.abs(delta.value)}
          </span>
        )}
      </div>
      <div className="relative mt-2.5 flex items-end justify-between gap-2">
        <div className="numeral text-[34px] font-bold text-ink">{value}</div>
        {spark && spark.length > 1 && <Sparkline data={spark} color={sparkColor ?? "#068AD3"} width={96} height={36} />}
      </div>
      {hint && <div className="relative mt-1 text-xs text-muted">{hint}</div>}
    </Comp>
  );
}

/* ---------------- Progress ring ---------------- */
export function ProgressRing({ value, size = 56, stroke = 6, color = "#068AD3", track = "#E9E9EE", children }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }} />
      </svg>
      <div className="absolute">{children}</div>
    </div>
  );
}

/* ---------------- Skeleton ---------------- */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

/* ---------------- Tooltip ---------------- */
export function Tooltip({ label, children, side = "top" }: { label: ReactNode; children: ReactNode; side?: "top" | "bottom" }) {
  const pos = side === "top" ? "bottom-full mb-2" : "top-full mt-2";
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span className={`pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 ${pos} whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/tt:opacity-100`}>
        {label}
      </span>
    </span>
  );
}

/* ---------------- Switch ---------------- */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 rounded-full transition-colors duration-200 ${checked ? "bg-brand-600" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-transform duration-200 ease-spring ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

/* ---------------- Tabs (animated underline) ---------------- */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={`relative px-3 py-2 text-sm transition-colors ${t.value === value ? "font-semibold text-ink" : "text-muted hover:text-ink"}`}>
          {t.label}
          {t.value === value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Toasts (no deps) ---------------- */
type Toast = { id: number; msg: string; tone: "default" | "success" | "error" };
let _toasts: Toast[] = [];
let _subs: ((t: Toast[]) => void)[] = [];
let _id = 0;
function emit() { _subs.forEach((f) => f([..._toasts])); }
export function toast(msg: string, tone: "default" | "success" | "error" = "default") {
  const id = ++_id;
  _toasts.push({ id, msg, tone });
  emit();
  setTimeout(() => { _toasts = _toasts.filter((t) => t.id !== id); emit(); }, 3200);
}
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => { _subs.push(setItems); return () => { _subs = _subs.filter((f) => f !== setItems); }; }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      {items.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex animate-toast-in items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg backdrop-blur
          ${t.tone === "success" ? "border-success-600/30 bg-success-50 text-success-600" : t.tone === "error" ? "border-danger-600/30 bg-danger-50 text-danger-600" : "border-line bg-surface text-ink"}`}>
          <span>{t.tone === "success" ? "✓" : t.tone === "error" ? "⚠" : "●"}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
