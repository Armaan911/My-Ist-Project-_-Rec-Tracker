"use client";
import { useState } from "react";
import { Search, Link2, Check, Copy, ExternalLink, Target, History } from "lucide-react";
import { Avatar, Badge, Button, Card, Input } from "@/components/ui";
import { EmptyState } from "@/components/Illustration";
import { prettyDate } from "@/lib/dates";
import { setRecruiterGoals } from "@/app/manager/goals-actions";
import { getRecruiterDailyHistory, type HistoryDay } from "@/app/manager/recruiters/history-actions";
import { toast } from "@/components/uikit";

type Recruiter = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  division_names: string[];
  submissions: number;
  closures: number;
  active_reqs: number;
};

type MintResult = { ok: boolean; token?: string; error?: string };

export default function RecruitersDirectory({
  recruiters,
  mintLink,
  subtitle,
}: {
  recruiters: Recruiter[];
  mintLink: (recruiterId: string) => Promise<MintResult>;
  subtitle?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = recruiters.filter((r) =>
    !q || `${r.full_name} ${r.email} ${r.division_names.join(" ")}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recruiters</h1>
        <p className="text-sm text-muted">{subtitle ?? "Everyone logging daily activity, with a one-tap link to their daily-update form."}</p>
      </div>

      <Card>
        <div className="mb-4 relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or division" className="pl-9" />
        </div>

        <div className="space-y-2">
          {filtered.map((r) => <Row key={r.id} r={r} mintLink={mintLink} />)}
          {filtered.length === 0 && <div className="py-4"><EmptyState illustration="people" title="No recruiters match that search" /></div>}
        </div>
      </Card>
    </div>
  );
}

function Row({ r, mintLink }: { r: Recruiter; mintLink: (id: string) => Promise<MintResult> }) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showGoals, setShowGoals] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [hist, setHist] = useState<HistoryDay[] | null>(null);
  const [histBusy, setHistBusy] = useState(false);

  async function loadHistory() {
    if (showHist) { setShowHist(false); return; }
    setShowHist(true);
    if (hist) return; // already loaded
    setHistBusy(true);
    const res = await getRecruiterDailyHistory(r.id);
    setHistBusy(false);
    if (res.ok) setHist(res.days ?? []); else toast(res.error ?? "Couldn't load history", "error");
  }
  const [subT, setSubT] = useState("");
  const [clT, setClT] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalMsg, setGoalMsg] = useState<string | null>(null);

  async function saveGoals() {
    setSavingGoal(true); setGoalMsg(null);
    const res = await setRecruiterGoals({
      recruiterId: r.id,
      submission_target: subT === "" ? null : Number(subT),
      closure_target: clT === "" ? null : Number(clT),
    });
    setSavingGoal(false);
    setGoalMsg(res.ok ? "Saved" : (res.error ?? "Error"));
    if (res.ok) { toast(`Targets saved for ${r.full_name}`, "success"); setTimeout(() => { setGoalMsg(null); setShowGoals(false); }, 1200); }
  }

  // Every click mints a brand-new single-use token, so the link is dynamic — it
  // changes each time, works once, and expires in 20h (same as the 3 AM email).
  async function generate() {
    setBusy(true); setErr(null); setCopied(false);
    const res = await mintLink(r.id);
    setBusy(false);
    if (!res.ok || !res.token) { setErr(res.error ?? "Could not create a link."); return; }
    const url = `${window.location.origin}/daily/${res.token}`;
    setLink(url);
    await copy(url);
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the link stays visible for manual copy
    }
  }

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={r.full_name} src={r.avatar_url} />
          <div>
            <div className="font-medium">{r.full_name}</div>
            <div className="text-xs text-muted">{r.email}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {r.division_names.length ? r.division_names.map((d) => <Badge key={d} tone="brand">{d}</Badge>) : <span className="text-xs text-muted">no division</span>}
            </div>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:w-auto">
          <Stat label="Submissions" value={r.submissions} />
          <Stat label="Closures" value={r.closures} />
          <Stat label="Open reqs" value={r.active_reqs} />
          <Button size="sm" variant="secondary" onClick={() => setShowGoals((s) => !s)}><Target size={14} /> Goals</Button>
          <Button size="sm" variant="secondary" onClick={loadHistory}><History size={14} /> {showHist ? "Hide history" : "History"}</Button>
          <Button size="sm" onClick={generate} disabled={busy}>
            {copied ? <><Check size={14} /> Copied</> : <><Link2 size={14} /> {busy ? "Creating…" : link ? "New link" : "Copy daily link"}</>}
          </Button>
        </div>
      </div>

      {showGoals && (
        <div className="mt-3 rounded-lg border border-line bg-canvas/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Target size={14} className="text-brand-700" /> Set this month&apos;s targets for {r.full_name}</div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">Submissions target</span>
              <input type="number" min={0} value={subT} onChange={(e) => setSubT(e.target.value)} className="h-9 w-32 rounded-lg border border-line bg-surface px-3 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">Closures target</span>
              <input type="number" min={0} value={clT} onChange={(e) => setClT(e.target.value)} className="h-9 w-32 rounded-lg border border-line bg-surface px-3 text-sm" />
            </label>
            <Button size="sm" disabled={savingGoal} onClick={saveGoals}>{savingGoal ? "Saving…" : "Save targets"}</Button>
            {goalMsg && <span className="text-sm text-success-600">{goalMsg}</span>}
          </div>
          <p className="mt-2 text-xs text-muted">Applies to the current month and powers pacing + the attainment scorecard. Leave blank to fall back to the recruiter&apos;s default.</p>
        </div>
      )}

      {showHist && (
        <div className="mt-3 rounded-lg border border-line bg-canvas/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><History size={14} className="text-brand-700" /> Daily update history — {r.full_name} <span className="text-xs font-normal text-muted">(last 45 days)</span></div>
          {histBusy ? (
            <p className="py-3 text-sm text-muted">Loading history…</p>
          ) : !hist || hist.length === 0 ? (
            <p className="py-3 text-sm text-muted">No activity logged in this window.</p>
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {hist.map((day) => (
                <div key={day.date} className="rounded-lg border border-line bg-surface p-3">
                  <div className="mb-2 text-sm font-semibold text-ink">{prettyDate(day.date, { weekday: "short", year: true })}</div>
                  {day.activity.length === 0 && day.submissions.length === 0 && <div className="text-xs text-muted">No entries.</div>}
                  {day.activity.map((a, i) => (
                    <div key={i} className="mb-1.5">
                      <div className="text-xs font-medium text-muted">{a.requirement}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1.5">
                        {a.metrics.map((m, j) => (
                          <span key={j} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ background: `${m.color}14`, color: m.color }}>
                            {m.label}: <b>{m.value}</b>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {day.submissions.length > 0 && (
                    <div className="mt-2 border-t border-line pt-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Candidates submitted</div>
                      <ul className="mt-1 space-y-0.5">
                        {day.submissions.map((s, k) => (
                          <li key={k} className="text-xs text-ink"><span className="font-medium">{s.candidate}</span> <span className="text-muted">· {s.requirement} · {s.status}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {link && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2">
          <ExternalLink size={13} className="shrink-0 text-muted" />
          <input readOnly value={link} className="w-full bg-transparent text-xs text-muted outline-none" onFocus={(e) => e.currentTarget.select()} />
          <button onClick={() => copy(link)} title="Copy" className="shrink-0 text-muted hover:text-ink"><Copy size={13} /></button>
        </div>
      )}
      {link && <p className="mt-1 text-xs text-muted">Single-use, no login needed, logs today only, expires in 20h. Clicking again creates a fresh link and the old one still works until used or expired.</p>}
      {err && <p className="mt-1 text-xs text-danger-600">{err}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
