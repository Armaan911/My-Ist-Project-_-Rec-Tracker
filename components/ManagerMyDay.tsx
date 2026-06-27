"use client";

import { useState } from "react";
import { Card, PriorityBadge, StatusBadge, Modal } from "@/components/ui";
import AlertsFeed from "@/components/AlertsFeed";
import AISummary from "@/components/AISummary";

type NewReq = { id: string; title: string; priority: string | null; status: string; date_received: string; client: string | null };
type UnallocReq = { id: string; title: string; priority: string | null; date_received: string; client: string | null };
type TeamMember = { id: string; name: string; logged: boolean; resumes: number; parsed: number };
type Alert = { id: string; type: string; severity: string; title: string; body: string | null; is_read: boolean; created_at: string };
type BreakSub = { recruiter: string; candidate: string; requirement: string; date: string };
type BreakReq = { title: string; priority: string | null; client: string | null; status: string };
type Breakdown = {
  internal: BreakSub[]; client: BreakSub[]; tech: BreakSub[]; closures: BreakSub[];
  reqOpen: BreakReq[]; reqOnHold: BreakReq[]; reqClosed: BreakReq[]; reqTotal: BreakReq[];
};

type Period = { label: string; windowLabel: string; submissions: number; closures: number; topPerformer: string | null; lagging: string | null };
type Data = {
  name: string;
  divisionName: string | null;
  newReqs: NewReq[];
  statusCounts: { open: number; on_hold: number; closed: number; filled: number; cancelled: number; total: number };
  subCards: { internal: number; client: number; tech: number; closures: number };
  periods: { today: Period; week: Period; month: Period; year: Period };
  unallocated: UnallocReq[];
  team: TeamMember[];
  alerts: Alert[];
  breakdown: Breakdown;
};

const SUB_TITLES: Record<string, string> = { internal: "Internally submitted", client: "Submitted to client", tech: "In tech interview", closures: "Closures" };
const REQ_TITLES: Record<string, string> = { reqOpen: "Open requirements", reqOnHold: "On-hold requirements", reqClosed: "Closed requirements", reqTotal: "All requirements" };

export default function ManagerMyDay({ data }: { data: Data }) {
  const s = data.statusCounts;
  const loggedCount = data.team.filter((t) => t.logged).length;
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year">("today");
  const p = data.periods[period];

  // Click a stat box to see the breakup of who did what.
  const [openBox, setOpenBox] = useState<string | null>(null);
  const isReqBox = !!openBox && openBox.startsWith("req");
  const boxTitle = openBox ? (SUB_TITLES[openBox] ?? REQ_TITLES[openBox] ?? "Details") : "";
  const subRows: BreakSub[] = openBox && !isReqBox ? ((data.breakdown as any)[openBox] ?? []) : [];
  const reqRows: BreakReq[] = openBox && isReqBox ? ((data.breakdown as any)[openBox] ?? []) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Good day, {data.name}</h1>
        <p className="text-sm text-muted">
          Your desk at a glance{data.divisionName ? ` · ${data.divisionName}` : ""}
        </p>
      </div>

      {/* Requirements by status */}
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Requirements</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Open" value={s.open} tone="brand" onClick={() => setOpenBox("reqOpen")} />
          <Stat label="On hold" value={s.on_hold} tone="warning" onClick={() => setOpenBox("reqOnHold")} />
          <Stat label="Closed" value={s.closed} tone="success" onClick={() => setOpenBox("reqClosed")} />
          <Stat label="Total" value={s.total} onClick={() => setOpenBox("reqTotal")} />
        </div>
      </div>

      {/* Submission summary */}
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Submission pipeline (current)</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Internally submitted" value={data.subCards.internal} onClick={() => setOpenBox("internal")} />
          <Stat label="Submitted to client" value={data.subCards.client} tone="brand" onClick={() => setOpenBox("client")} />
          <Stat label="In tech interview" value={data.subCards.tech} onClick={() => setOpenBox("tech")} />
          <Stat label="Closures" value={data.subCards.closures} tone="success" onClick={() => setOpenBox("closures")} />
        </div>
      </div>

      {/* Performance — switchable by period */}
      <Card
        title={`Performance · ${p.label}`}
        action={
          <select
            className="h-9 rounded-lg border border-line bg-surface px-2 text-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
          >
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="year">This year</option>
          </select>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Submissions" value={p.submissions} />
          <Stat label="Closures" value={p.closures} tone="success" />
          <div className="col-span-2 rounded-xl border border-line p-4">
            <div className="text-xs uppercase tracking-wide text-muted">Momentum · {p.windowLabel}</div>
            <p className="mt-1 text-sm">
              {p.topPerformer ? <>Top performer: <b>{p.topPerformer}</b></> : "Not enough data to rank performers yet."}
            </p>
            {p.lagging && p.lagging !== p.topPerformer && (
              <p className="text-sm text-muted">Needs a nudge: <b>{p.lagging}</b></p>
            )}
          </div>
        </div>
      </Card>

      <AISummary />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Newly added requirements */}
        <Card title="New requirements (last 7 days)">
          {data.newReqs.length === 0 ? (
            <p className="py-2 text-sm text-muted">No new requirements added recently.</p>
          ) : (
            <ul className="space-y-2">
              {data.newReqs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted">{r.client ?? "no client"} · received {r.date_received}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <PriorityBadge value={r.priority} />
                    <StatusBadge value={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Unallocated open reqs */}
        <Card title="Open reqs not yet allocated" action={<span className="text-xs text-muted">{data.unallocated.length} to assign</span>}>
          {data.unallocated.length === 0 ? (
            <p className="py-2 text-sm text-muted">Every open requirement has someone assigned. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {data.unallocated.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted">{r.client ?? "no client"} · received {r.date_received}</p>
                  </div>
                  <PriorityBadge value={r.priority} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Team activity today */}
      <Card title="Team activity today" action={<span className="text-xs text-muted">{loggedCount}/{data.team.length} logged</span>}>
        {data.team.length === 0 ? (
          <p className="py-2 text-sm text-muted">No recruiters on your desk yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.team.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm">{t.name}</span>
                {t.logged ? (
                  <span className="text-xs text-success-600">
                    ✓ {t.resumes} resumes · {t.parsed} parsed
                  </span>
                ) : (
                  <span className="text-xs text-muted">not logged yet</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AlertsFeed alerts={data.alerts} />

      <Modal open={!!openBox} onClose={() => setOpenBox(null)} wide title={boxTitle}
        description={isReqBox ? `${reqRows.length} requirement${reqRows.length === 1 ? "" : "s"}` : `${subRows.length} candidate${subRows.length === 1 ? "" : "s"} · who did what`}>
        <div className="max-h-[60vh] overflow-auto">
          {isReqBox ? (
            reqRows.length === 0 ? <p className="py-6 text-center text-sm text-muted">Nothing here.</p> : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted">
                  <tr><th className="py-2 pr-3 font-medium">Requirement</th><th className="pr-3 font-medium">Client</th><th className="pr-3 font-medium">Priority</th><th className="font-medium">Status</th></tr>
                </thead>
                <tbody>
                  {reqRows.map((r, i) => (
                    <tr key={i} className="border-t border-line/60">
                      <td className="py-2 pr-3 font-medium">{r.title}</td>
                      <td className="pr-3 text-muted">{r.client ?? "—"}</td>
                      <td className="pr-3"><PriorityBadge value={r.priority} /></td>
                      <td><StatusBadge value={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            subRows.length === 0 ? <p className="py-6 text-center text-sm text-muted">Nothing here.</p> : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted">
                  <tr><th className="py-2 pr-3 font-medium">Recruiter</th><th className="pr-3 font-medium">Candidate</th><th className="pr-3 font-medium">Requirement</th><th className="font-medium">Date</th></tr>
                </thead>
                <tbody>
                  {subRows.map((r, i) => (
                    <tr key={i} className="border-t border-line/60">
                      <td className="py-2 pr-3 font-medium">{r.recruiter}</td>
                      <td className="pr-3">{r.candidate}</td>
                      <td className="pr-3 text-muted">{r.requirement}</td>
                      <td className="text-muted">{r.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
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
