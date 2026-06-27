"use client";

import { useState } from "react";
import { Badge, Card, Modal, PriorityBadge } from "@/components/ui";
import FunnelByStage from "@/components/charts/FunnelByStage";
import ClosuresByRecruiterCard from "@/components/ClosuresByRecruiterCard";
import TrendChart from "@/components/charts/TrendChart";
import Leaderboard from "@/components/Leaderboard";
import AlertsFeed from "@/components/AlertsFeed";
import PerformerCards from "@/components/PerformerCards";
import AISummary from "@/components/AISummary";
import AskData from "@/components/AskData";
import RecruiterPerformance from "@/components/RecruiterPerformance";
import DetailedAnalytics from "@/components/DetailedAnalytics";
import RangeReport from "@/components/RangeReport";
import PerformanceTracking from "@/components/PerformanceTracking";
import ExportButton from "@/components/ExportButton";
import { usePaged, Pager } from "@/components/Pager";

type StatKey = "openReqs" | "subsMonth" | "closuresMonth" | "recruiters";

export default function ManagerDashboard({ data, verified, today }: { data: any; verified?: any; today: string }) {
  const [detailed, setDetailed] = useState(false);
  const [openStat, setOpenStat] = useState<StatKey | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  // "Verified only" swaps to the coordinator-verified dataset (default: everything).
  const active = verifiedOnly && verified ? verified : data;
  // Supports both the new shape ({ divisions, overall, byDivision }) and a plain data object.
  const hasDivisions = !!active?.overall;
  const divisions: { id: string; name: string }[] = hasDivisions ? active.divisions ?? [] : [];
  const [tab, setTab] = useState<string>("all"); // 'all' | division id
  const view = hasDivisions ? (tab === "all" ? active.overall : active.byDivision[tab] ?? active.overall) : active;
  const s = view.stats;
  const details = view.details ?? { openRequirements: [], submissions: [], closures: [], recruiters: [] };
  // Stage filter for the "Submissions this month" drill-down.
  const subStages: string[] = Array.from(new Set((details.submissions ?? []).map((x: any) => x.status).filter(Boolean)));
  const filteredSubs = stageFilter === "all" ? (details.submissions ?? []) : (details.submissions ?? []).filter((x: any) => x.status === stageFilter);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">Team dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-line p-0.5">
            <span className="px-1.5 text-xs text-muted">Export</span>
            <ExportButton divisionId={tab === "all" ? null : tab} period="today" label="Today" />
            <ExportButton divisionId={tab === "all" ? null : tab} period="week" label="Week" />
            <ExportButton divisionId={tab === "all" ? null : tab} period="month" label="Month" />
          </div>
          {verified && (
            <button onClick={() => setVerifiedOnly((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${verifiedOnly ? "border-success-600/40 bg-success-50 text-success-600" : "border-line text-muted hover:text-ink"}`}>
              <span className={`h-2 w-2 rounded-full ${verifiedOnly ? "bg-success-600" : "bg-line"}`} /> Verified only
            </button>
          )}
          <div className="flex items-center rounded-lg bg-brand-600 p-0.5 text-sm shadow-sm">
            {(["simple", "detailed"] as const).map((v) => {
              const active = (detailed ? "detailed" : "simple") === v;
              return (
                <button key={v} onClick={() => setDetailed(v === "detailed")}
                  className={`rounded-md px-3 py-1 capitalize transition-colors ${active ? "bg-white font-semibold text-brand-700" : "text-white/85 hover:text-white"}`}>
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {hasDivisions && divisions.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-line">
          {[{ id: "all", name: "Overall" }, ...divisions].map((d) => {
            const active = tab === d.id;
            return (
              <button key={d.id} onClick={() => setTab(d.id)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${active ? "border-brand-600 font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}>
                {d.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Open requirements" value={s.openReqs} tone="brand" onClick={() => setOpenStat("openReqs")} />
        <Stat label="Submissions this month" value={s.subsMonth} tone="brand" onClick={() => setOpenStat("subsMonth")} />
        <Stat label="Closures this month" value={s.closuresMonth} tone="success" onClick={() => setOpenStat("closuresMonth")} />
        <Stat label="Active recruiters" value={s.activeRecruiters} onClick={() => setOpenStat("recruiters")} />
      </div>

      <PerformerCards week={view.performers.week} month={view.performers.month} year={view.performers.year} />

      <RecruiterPerformance recruiterStats={view.recruiterStats ?? []} overallPie={view.overallPie ?? []} divisionId={tab === "all" ? null : tab} today={today} />

      <AISummary />

      <AskData />

      <AlertsFeed alerts={view.alerts} />

      {!detailed ? (
        <>
          <ClosuresByRecruiterCard recruiters={(view.recruiterStats ?? []).map((r: any) => ({ id: r.id, name: r.name }))} initial={view.byRecruiter} divisionId={tab === "all" ? null : tab} today={today} />
          <Leaderboard periods={view.leaderboards} />
        </>
      ) : (
        <>
          <RangeReport divisionId={tab === "all" ? null : tab} today={today} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-lg font-semibold">Pipeline — current funnel</h2>
              <FunnelByStage data={view.funnel} />
            </Card>
            <ClosuresByRecruiterCard recruiters={(view.recruiterStats ?? []).map((r: any) => ({ id: r.id, name: r.name }))} initial={view.byRecruiter} divisionId={tab === "all" ? null : tab} today={today} />
          </div>
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Submissions vs closures — last 8 weeks</h2>
            <TrendChart data={view.trend} />
          </Card>
          <DetailedAnalytics analytics={view.analytics} divisionId={tab === "all" ? null : tab} today={today} />
          {active.performance && <PerformanceTracking perf={active.performance} today={today} />}
          <Leaderboard periods={view.leaderboards} />
        </>
      )}

      {/* #2 — drill-down modals behind each stat card */}
      <Modal open={openStat === "openReqs"} onClose={() => setOpenStat(null)} wide
        title="Open requirements" description={`${details.openRequirements.length} role${details.openRequirements.length === 1 ? "" : "s"} currently open`}>
        <SimpleTable
          head={["Requirement", "Job code", "Client", "Priority", "Received"]}
          rows={details.openRequirements.map((r: any) => [r.title, r.job_code ?? "—", r.client ?? "—", r.priority ? <PriorityBadge value={r.priority} /> : "—", r.date_received])}
          empty="No open requirements." />
      </Modal>

      <Modal open={openStat === "subsMonth"} onClose={() => { setOpenStat(null); setStageFilter("all"); }} wide
        title="Submissions this month" description={`${filteredSubs.length} of ${details.submissions.length} submission${details.submissions.length === 1 ? "" : "s"}`}>
        <div className="mb-3 flex items-center gap-2">
          <label className="text-xs font-medium text-muted">Filter by stage</label>
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm">
            <option value="all">All stages</option>
            {subStages.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>
        <SimpleTable
          head={["Candidate", "Recruiter", "Requirement", "Stage", "Date"]}
          rows={filteredSubs.map((s: any) => [s.candidate, s.recruiter, s.requirement, <Badge tone={stageTone(s.status)}>{s.status}</Badge>, s.date])}
          empty="No submissions in this stage." />
      </Modal>

      <Modal open={openStat === "closuresMonth"} onClose={() => setOpenStat(null)} wide
        title="Closures this month" description={`${details.closures.length} closure${details.closures.length === 1 ? "" : "s"} this month`}>
        <SimpleTable
          head={["Candidate", "Recruiter", "Requirement", "Closed on"]}
          rows={details.closures.map((c: any) => [c.candidate, c.recruiter, c.requirement, c.date])}
          empty="No closures yet this month." />
      </Modal>

      <Modal open={openStat === "recruiters"} onClose={() => setOpenStat(null)} wide
        title="Active recruiters" description={`${details.recruiters.length} recruiter${details.recruiters.length === 1 ? "" : "s"} on this view`}>
        <SimpleTable
          head={["Recruiter", "Submissions (mo)", "Closures (mo)"]}
          rows={details.recruiters.map((r: any) => [r.name, r.submissionsMonth, r.closuresMonth])}
          empty="No recruiters in this division." />
      </Modal>
    </div>
  );
}

function Stat({ label, value, tone, onClick }: { label: string; value: any; tone?: "brand" | "success" | "warning"; onClick?: () => void }) {
  const accent =
    tone === "brand" ? "text-brand-700" : tone === "success" ? "text-success-600" : tone === "warning" ? "text-warning-600" : "text-ink";
  const content = (
    <div className={`rounded-2xl border border-line bg-surface p-4 transition-all ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md" : "elevate"}`}>
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
  return onClick ? <button type="button" onClick={onClick} className="block w-full rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200">{content}</button> : content;
}

// Colour a submission stage: internal submission = blue, client submission = green.
function stageTone(status: string): "brand" | "success" | "neutral" {
  const l = (status || "").toLowerCase();
  if (l.includes("client")) return "success";
  if (l.includes("internal")) return "brand";
  return "neutral";
}

function SimpleTable({ head, rows, empty }: { head: React.ReactNode[]; rows: React.ReactNode[][]; empty: string }) {
  const pg = usePaged(rows, 20);
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <>
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted">
            <tr>{head.map((h, i) => <th key={i} className="py-2 pr-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {pg.slice.map((r, i) => (
              <tr key={i} className="border-t border-line/60">
                {r.map((c, j) => <td key={j} className="py-2 pr-3 align-top">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={pg.page} pageCount={pg.pageCount} setPage={pg.setPage} total={pg.total} pageSize={pg.pageSize} />
    </>
  );
}
