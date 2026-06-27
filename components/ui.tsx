import { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-gradient-to-b from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 shadow-[0_1px_2px_rgba(23,23,31,0.12),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-md",
  secondary: "bg-surface text-ink border border-line hover:bg-canvas hover:border-brand-200",
  ghost: "text-ink hover:bg-canvas",
  danger: "bg-danger-600 text-white hover:opacity-90 shadow-xs",
  subtle: "bg-brand-50 text-brand-700 hover:bg-brand-100",
  outline: "border border-brand-200 text-brand-700 hover:bg-brand-50",
};
const SIZES: Record<Size, string> = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-11 px-5 text-sm" };

export function Button({
  variant = "primary", size = "md", className = "", loading = false, disabled, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 ease-spring active:translate-y-px focus-visible:outline-none focus-visible:shadow-ring disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={`h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/60 transition-shadow focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 ${className}`}
    />
  );
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={`w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/60 transition-shadow focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 ${className}`}
    />
  );
}

export function Card({
  children, className = "", title, action, hover = false, accent = false,
}: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; hover?: boolean; accent?: boolean }) {
  const hasPad = /\bp[xytrbl]?-/.test(className);
  return (
    <div className={`rounded-2xl border border-line bg-surface elevate ${hover ? "elevate-hover" : ""} ${accent ? "accent-top" : ""} ${hasPad ? "" : "p-6"} ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-xs font-medium text-muted">{children}</label>;
}

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const TONES: Record<Tone, string> = {
  neutral: "bg-canvas text-muted border border-line",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  info: "bg-accent-50 text-accent-600",
};
const DOT: Record<Tone, string> = { neutral: "bg-muted", brand: "bg-brand-600", success: "bg-success-600", warning: "bg-warning-600", danger: "bg-danger-600", info: "bg-accent-600" };
export function Badge({
  children, tone = "neutral", dot = false, className = "", style,
}: { children: ReactNode; tone?: Tone; dot?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <span style={style} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />}
      {children}
    </span>
  );
}

// ---- shared colour coding for priority & requirement status ----
const PRIORITY_TONE: Record<string, Tone> = { high: "danger", med: "warning", medium: "warning", low: "success" };
const PRIORITY_LABEL: Record<string, string> = { high: "High", med: "Medium", medium: "Medium", low: "Low" };
export function PriorityBadge({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className="text-xs text-muted">—</span>;
  const key = value.toLowerCase();
  return <Badge tone={PRIORITY_TONE[key] ?? "neutral"} className={className}>{PRIORITY_LABEL[key] ?? value}</Badge>;
}

const STATUS_TONE: Record<string, Tone> = { open: "brand", on_hold: "warning", closed: "neutral", filled: "success", cancelled: "danger" };
const STATUS_LABEL: Record<string, string> = { open: "Open", on_hold: "On hold", closed: "Closed", filled: "Filled", cancelled: "Cancelled" };
export function StatusBadge({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className="text-xs text-muted">—</span>;
  const key = value.toLowerCase();
  return <Badge tone={STATUS_TONE[key] ?? "neutral"} className={className}>{STATUS_LABEL[key] ?? value}</Badge>;
}

// matching text colours for inline use (e.g. a <select>'s value)
export const priorityTextClass = (v?: string | null) =>
  ({ high: "text-danger-600", med: "text-warning-600", medium: "text-warning-600", low: "text-success-600" } as Record<string, string>)[(v ?? "").toLowerCase()] ?? "text-ink";
export const statusTextClass = (v?: string | null) =>
  ({ open: "text-brand-700", on_hold: "text-warning-600", closed: "text-muted", filled: "text-success-600", cancelled: "text-danger-600" } as Record<string, string>)[(v ?? "").toLowerCase()] ?? "text-ink";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// Modal is portaled to <body> to avoid transformed-ancestor positioning bugs (it was
// stretching down the whole team-dashboard page). See components/Modal.tsx.
export { Modal } from "@/components/Modal";

export function Avatar({ name, src, size = 36, status, className = "" }: { name: string; src?: string | null; size?: number; status?: "online" | "away" | null; className?: string }) {
  const initials = (name || "").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const dot = status ? <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${status === "online" ? "bg-success-600" : "bg-warning-600"}`} /> : null;
  const fontSize = Math.max(10, Math.round(size * 0.34));
  return (
    <span className={`relative inline-grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }}>
      {src
        ? <img src={src} alt={name} className="h-full w-full rounded-full object-cover ring-1 ring-line" />
        : <span className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-brand-100 to-brand-50 font-semibold text-brand-700" style={{ fontSize }}>{initials || "?"}</span>}
      {dot}
    </span>
  );
}
