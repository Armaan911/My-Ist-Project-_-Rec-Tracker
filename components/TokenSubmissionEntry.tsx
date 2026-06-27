"use client";
import { useState } from "react";
import { UserPlus, Check } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { isValidLinkedInUrl } from "@/lib/validation";

type Req = { id: string; title: string; job_code?: string | null; division_name?: string | null };
type Status = { id: string; label: string };
type SaveFn = (input: { requirement_id: string; candidate_name: string; linkedin_url: string; status_id: string; submitted_date: string }) => Promise<{ ok: boolean; error?: string }>;

export default function TokenSubmissionEntry({ reqs, statuses, forDate, save }: { reqs: Req[]; statuses: Status[]; forDate: string; save: SaveFn }) {
  const [name, setName] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [reqId, setReqId] = useState(reqs[0]?.id ?? "");
  const [statusId, setStatusId] = useState(statuses[0]?.id ?? "");
  const [date, setDate] = useState(forDate);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  const linkedinInvalid = linkedin.trim() !== "" && !isValidLinkedInUrl(linkedin);
  const canAdd = !!name.trim() && isValidLinkedInUrl(linkedin) && !!reqId && !!statusId;

  async function add() {
    setErr(null);
    if (!name.trim()) return setErr("Candidate name is required.");
    if (!isValidLinkedInUrl(linkedin)) return setErr("Enter a valid LinkedIn URL — it must start with https:// and be on linkedin.com.");
    if (!reqId) return setErr("Pick a requirement.");
    setBusy(true);
    const res = await save({ requirement_id: reqId, candidate_name: name.trim(), linkedin_url: linkedin.trim(), status_id: statusId, submitted_date: date });
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? "Could not save.");
    setAdded([name.trim(), ...added]);
    setName(""); setLinkedin("");
  }

  if (reqs.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2 text-[15px] font-semibold"><UserPlus size={16} className="text-brand-700" /> Candidate submissions</div>
        <p className="mt-2 text-sm text-muted">No live requirements are assigned to you right now, so there's nothing to submit candidates against. You can still log your activity counts below.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2 text-[15px] font-semibold"><UserPlus size={16} className="text-brand-700" /> Candidate submissions</div>
      <p className="mt-1 text-sm text-muted">Add each candidate you submitted. Name and LinkedIn are both required.</p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label>Candidate name <span className="text-danger-600">*</span></Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </div>
        <div>
          <Label>Candidate LinkedIn URL <span className="text-danger-600">*</span></Label>
          <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…"
            className={linkedinInvalid ? "border-danger-600 focus:border-danger-600" : ""} />
          {linkedinInvalid && <p className="mt-1 text-xs text-danger-600">Must start with https:// and be a linkedin.com URL.</p>}
        </div>
        <div>
          <Label>Requirement</Label>
          <select className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm" value={reqId} onChange={(e) => setReqId(e.target.value)}>
            {reqs.map((r) => <option key={r.id} value={r.id}>{r.title}{r.job_code ? ` · ${r.job_code}` : ""}{r.division_name ? ` (${r.division_name})` : ""}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Status</Label>
            <select className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm" value={statusId} onChange={(e) => setStatusId(e.target.value)}>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button onClick={add} disabled={!canAdd || busy}>{busy ? "Adding…" : "Add candidate"}</Button>
        {err && <span className="text-sm font-medium text-danger-600">{err}</span>}
      </div>

      {added.length > 0 && (
        <div className="mt-4 rounded-xl border border-success-600/20 bg-success-50/50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-success-600">Submitted just now ({added.length})</div>
          <ul className="mt-1 space-y-0.5">
            {added.map((n, i) => <li key={i} className="flex items-center gap-1.5 text-sm"><Check size={14} className="text-success-600" /> {n}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
