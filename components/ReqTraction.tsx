"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import FunnelByStage from "@/components/charts/FunnelByStage";
import TrendChart from "@/components/charts/TrendChart";
import PieBreakdown from "@/components/charts/PieBreakdown";
import RecruiterStageBar from "@/components/charts/RecruiterStageBar";
import { generateReqInsight } from "@/app/req-traction/ai-actions";

export type ReqCardData = {
  id: string; title: string; jobCode: string | null; client: string | null; division: string | null;
  priority: string | null; positions: number; dateReceived: string; ageDays: number; total: number; closures: number;
  rejections: number; rrTotal: number; clientTotal: number; positionsRemaining: number; activeRecruiters: number;
  topRecruiter: { name: string; count: number } | null; daysSinceActivity: number | null; timeToFirstSub: number | null;
  weeklyVelocity: number; conversionRate: number; rejectionRate: number; rrToClient: number | null; fillRate: number | null;
  byStage: { stage: string; count: number }[];
  byRecruiter: { name: string; rr: number; client: number }[];
  trend: { week: string; submissions: number; closures: number }[];
  fill: { name: string; value: number; color?: string }[];
};

export default function ReqTraction({ cards }: { cards: ReqCardData[] }) {
  const [sel, setSel] = useState("all");
  const shown = sel === "all" ? cards : cards.filter((c) => c.id === sel);
  const totalSubs = cards.reduce((n, c) => n + c.total, 0);
  const totalClos = cards.reduce((n, c) => n + c.closures, 0);
  const avgAge = cards.length ? Math.round(cards.reduce((n, c) => n + c.ageDays, 0) / cards.length) : 0;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Req-Traction</h1>
          <p className="text-sm text-muted">Active requirement analytics — pipeline progress, recruiter breakup, closures and aging.</p>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-muted">Job requirement</label>
          <select value={sel} onChange={(e) => setSel(e.target.value)} className="mt-1 h-10 min-w-[260px] rounded-lg border border-line bg-surface px-3 text-sm">
            <option value="all">All active requirements ({cards.length})</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.title}{c.jobCode ? ` · ${c.jobCode}` : ""}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active requirements" value={cards.length} />
        <Stat label="Total submissions" value={totalSubs} />
        <Stat label="Total closures" value={totalClos} tone="success" />
        <Stat label="Avg. aging (days)" value={avgAge} />
      </div>

      {shown.length === 0
        ? <Card><p className="py-12 text-center text-sm text-muted">No active requirements yet. Add open requirements to see their traction here.</p></Card>
        : shown.map((c) => <ReqCard key={c.id} c={c} />)}
    </>
  );
}

function ReqCard({ c }: { c: ReqCardData }) {
  const age = c.ageDays <= 14 ? { cls: "bg-success-50 text-success-600", word: "Fresh" }
    : c.ageDays <= 30 ? { cls: "bg-warning-50 text-warning-600", word: "Aging" }
    : { cls: "bg-danger-50 text-danger-600", word: "Stale" };
  const pri = c.priority === "high" ? "bg-danger-50 text-danger-600" : c.priority === "medium" ? "bg-warning-50 text-warning-600" : "bg-canvas text-muted";

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{c.title}</h2>
            {c.jobCode && <span className="rounded bg-canvas px-1.5 py-0.5 text-xs text-muted">{c.jobCode}</span>}
          </div>
          <p className="mt-0.5 text-sm text-muted">{[c.client, c.division].filter(Boolean).join(" · ") || "—"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {c.priority && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${pri}`}>{c.priority}</span>}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${age.cls}`}>{age.word} · {c.ageDays}d open</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Mini label="Submissions" value={c.total} />
        <Mini label="In RR" value={c.rrTotal} />
        <Mini label="To client" value={c.clientTotal} />
        <Mini label="Closures" value={c.closures} tone="success" />
        <Mini label="Fill rate" value={c.fillRate == null ? "—" : `${c.fillRate}%`} />
        <Mini label="Positions left" value={c.positionsRemaining} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip label="Submission → closure" value={`${c.conversionRate}%`} />
        {c.rrToClient != null && <Chip label="RR → client" value={`${c.rrToClient}%`} />}
        <Chip label="Rejection rate" value={`${c.rejectionRate}%`} tone={c.rejectionRate >= 40 ? "bad" : undefined} />
        <Chip label="Active recruiters" value={c.activeRecruiters} />
        {c.topRecruiter && <Chip label="Top contributor" value={`${c.topRecruiter.name} (${c.topRecruiter.count})`} />}
        <Chip label="Velocity" value={`${c.weeklyVelocity}/wk`} />
        {c.daysSinceActivity != null && <Chip label="Last activity" value={c.daysSinceActivity === 0 ? "today" : `${c.daysSinceActivity}d ago`} tone={c.daysSinceActivity >= 14 ? "bad" : c.daysSinceActivity >= 7 ? "warn" : "good"} />}
        {c.timeToFirstSub != null && <Chip label="Time to 1st sub" value={`${c.timeToFirstSub}d`} />}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartBox title="Pipeline by stage"><FunnelByStage data={c.byStage} /></ChartBox>
        <ChartBox title="Recruiter breakup — RR vs Client submissions"><RecruiterStageBar data={c.byRecruiter} /></ChartBox>
        <ChartBox title="Progress over time (last 8 weeks)"><TrendChart data={c.trend} /></ChartBox>
        <ChartBox title="Closure vs open positions"><PieBreakdown data={c.fill} /></ChartBox>
      </div>

      <ReqAIInsight id={c.id} />
    </Card>
  );
}

function ReqAIInsight({ id }: { id: string }) {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function gen() {
    setBusy(true);
    const r = await generateReqInsight(id);
    setText(r?.text ?? "Could not generate insight.");
    setBusy(false);
  }
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-700"><Sparkles size={15} /> AI Insights</div>
        <button onClick={gen} disabled={busy}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50">
          {busy ? "Generating…" : text ? "Regenerate" : "Generate"}
        </button>
      </div>
      {text
        ? <p className="mt-2 text-sm leading-relaxed text-ink">{text}</p>
        : <p className="mt-2 text-xs text-muted">Generate a concise, manager-friendly read of this requirement’s progress, key observations and one recommendation.</p>}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "success" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 elevate">
      <div className={`text-2xl font-bold ${tone === "success" ? "text-success-600" : "text-ink"}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
function Mini({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "success" }) {
  return (
    <div className="rounded-xl border border-line bg-canvas/60 p-3">
      <div className={`text-lg font-bold ${tone === "success" ? "text-success-600" : "text-ink"}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
function Chip({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "good" | "warn" | "bad" }) {
  const cls = tone === "bad" ? "border-danger-600/30 bg-danger-50 text-danger-600"
    : tone === "warn" ? "border-warning-600/30 bg-warning-50 text-warning-600"
    : tone === "good" ? "border-success-600/30 bg-success-50 text-success-600"
    : "border-line bg-canvas/60 text-ink";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${cls}`}>
      <span className="opacity-70">{label}:</span> <span className="font-semibold">{value}</span>
    </span>
  );
}
function ChartBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-1.5 text-sm font-medium text-ink">{title}</div>
      {children}
    </div>
  );
}
