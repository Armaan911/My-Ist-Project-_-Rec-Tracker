"use client";

import { useState } from "react";
import { createSubmission, updateSubmissionStatus, deleteSubmission, updateSubmissionName, updateSubmissionDate, findDuplicateSubmissions } from "@/app/submissions/actions";
import type { DuplicateHit } from "@/app/submissions/actions";
import { Button, Card, Input, Label, Avatar } from "@/components/ui";
import ImageUpload from "@/components/ImageUpload";
import { createClient } from "@/lib/supabase/client";
import type { SubmissionStatus } from "@/lib/types";
import { isValidLinkedInUrl } from "@/lib/validation";

type Req = { id: string; title: string };
type Sub = {
  id: string; candidate_name: string; current_status_id: string; submitted_date: string;
  requirement_id?: string | null;
  requirements?: { title: string } | null; linkedin_url?: string | null;
  current_company?: string | null; current_title?: string | null; total_experience?: number | null;
  current_location?: string | null; resume_url?: string | null; candidate_photo_url?: string | null;
};

const SOURCES = ["", "LinkedIn", "Naukri", "Referral", "Job board", "Job portal", "Internal DB", "Other"];

const emptyDetails = {
  candidate_email: "", phone: "", current_location: "", total_experience: "",
  current_company: "", current_title: "", current_ctc: "", expected_ctc: "",
  notice_period: "", source: "", key_skills: "", resume_url: "", linkedin_url: "",
};

export default function SubmissionsPanel({ requirements, statuses, submissions }: { requirements: Req[]; statuses: SubmissionStatus[]; submissions: Sub[] }) {
  const [name, setName] = useState("");
  const [reqId, setReqId] = useState(requirements[0]?.id ?? "");
  const [statusId, setStatusId] = useState(statuses[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [d, setD] = useState({ ...emptyDetails });
  const [more, setMore] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [dupes, setDupes] = useState<DuplicateHit[]>([]);
  const [checking, setChecking] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [q, setQ] = useState("");
  const [reqFilter, setReqFilter] = useState("all");
  const qq = q.trim().toLowerCase();
  const visible = submissions.filter((s) => {
    if (reqFilter !== "all" && s.requirement_id !== reqFilter) return false;
    if (qq && !((s.candidate_name ?? "").toLowerCase().includes(qq) || (s.requirements?.title ?? "").toLowerCase().includes(qq))) return false;
    return true;
  });

  async function checkDupes() {
    if (!d.candidate_email.trim() && !d.phone.trim()) { setDupes([]); return; }
    setChecking(true);
    const res = await findDuplicateSubmissions(d.candidate_email, d.phone);
    setDupes(res.hits);
    setChecking(false);
  }
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof emptyDetails, v: string) => setD((p) => ({ ...p, [k]: v }));

  async function uploadResume(f: File) {
    if (f.size > 4 * 1024 * 1024) { setMsg("Resume must be under 4 MB."); return; }
    setResumeBusy(true);
    try {
      const supabase = createClient();
      const ext = (f.name.split(".").pop() || "pdf").toLowerCase();
      const path = `resumes/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from("candidates").upload(path, f, { upsert: true });
      if (error) { setMsg("Resume upload failed: " + error.message); return; }
      const { data } = supabase.storage.from("candidates").getPublicUrl(path);
      set("resume_url", data.publicUrl);
      setMsg("Resume uploaded.");
    } finally { setResumeBusy(false); }
  }

  // Live LinkedIn URL validation: must be https and on linkedin.com.
  const linkedinInvalid = d.linkedin_url.trim() !== "" && !isValidLinkedInUrl(d.linkedin_url);
  const canAdd = !!name.trim() && !!reqId && !!statusId && isValidLinkedInUrl(d.linkedin_url);

  async function add() {
    if (!name.trim() || !reqId || !statusId) { setMsg("Fill candidate, requirement, status."); return; }
    if (!isValidLinkedInUrl(d.linkedin_url)) { setMsg("Enter a valid LinkedIn URL — it must start with https:// and be on linkedin.com."); return; }
    const res = await createSubmission({ requirement_id: reqId, candidate_name: name, status_id: statusId, submitted_date: date, ...d, candidate_photo_url: photo || undefined });
    setMsg(res.ok ? "Added." : "Error: " + res.error);
    if (res.ok) { setName(""); setD({ ...emptyDetails }); setPhoto(null); setDupes([]); setMore(false); }
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Submissions</h2>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="col-span-2"><Label>Candidate <span className="text-danger-600">*</span></Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="col-span-2">
          <Label>Candidate LinkedIn <span className="text-danger-600">*</span></Label>
          <Input value={d.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/…"
            className={linkedinInvalid ? "border-danger-600 focus:border-danger-600" : ""} />
          {linkedinInvalid && <p className="mt-1 text-xs text-danger-600">Must start with https:// and be a linkedin.com URL.</p>}
        </div>
        <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div>
          <Label>Requirement</Label>
          <select className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm" value={reqId} onChange={(e) => setReqId(e.target.value)}>
            {requirements.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
        </div>
        <div>
          <Label>Status</Label>
          <select className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm" value={statusId} onChange={(e) => setStatusId(e.target.value)}>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex items-end"><Button disabled={!canAdd} onClick={add}>Add</Button></div>
      </div>

      <button onClick={() => setMore((m) => !m)} className="mt-3 text-sm font-medium text-brand-700 hover:underline">
        {more ? "− Hide candidate details" : "+ Add candidate details (contact, experience, CTC, skills…)"}
      </button>

      {more && (
        <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-line bg-canvas/50 p-3 md:grid-cols-4">
          <div className="col-span-2 md:col-span-4"><Label>Candidate photo</Label><ImageUpload bucket="candidates" prefix="sub" value={photo} onChange={setPhoto} shape="circle" label="Upload photo" /></div>
          <div><Label>Email</Label><Input type="email" value={d.candidate_email} onChange={(e) => set("candidate_email", e.target.value)} onBlur={checkDupes} /></div>
          <div><Label>Phone</Label><Input value={d.phone} onChange={(e) => set("phone", e.target.value)} onBlur={checkDupes} /></div>
          <div><Label>Current location</Label><Input value={d.current_location} onChange={(e) => set("current_location", e.target.value)} /></div>
          <div><Label>Experience (yrs)</Label><Input type="number" step="0.5" min={0} value={d.total_experience} onChange={(e) => set("total_experience", e.target.value)} /></div>
          <div><Label>Current company</Label><Input value={d.current_company} onChange={(e) => set("current_company", e.target.value)} /></div>
          <div><Label>Current title</Label><Input value={d.current_title} onChange={(e) => set("current_title", e.target.value)} /></div>
          <div><Label>Current CTC</Label><Input value={d.current_ctc} onChange={(e) => set("current_ctc", e.target.value)} placeholder="e.g. 12 LPA" /></div>
          <div><Label>Expected CTC</Label><Input value={d.expected_ctc} onChange={(e) => set("expected_ctc", e.target.value)} /></div>
          <div><Label>Notice period</Label><Input value={d.notice_period} onChange={(e) => set("notice_period", e.target.value)} placeholder="e.g. 30 days" /></div>
          <div><Label>Source</Label>
            <select className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm" value={d.source} onChange={(e) => set("source", e.target.value)}>
              {SOURCES.map((s) => <option key={s} value={s}>{s || "—"}</option>)}
            </select>
          </div>
          <div className="md:col-span-2"><Label>Key skills</Label><Input value={d.key_skills} onChange={(e) => set("key_skills", e.target.value)} placeholder="React, Node, AWS…" /></div>
          <div className="md:col-span-2">
            <Label>Resume (optional)</Label>
            <div className="flex items-center gap-2">
              <Input value={d.resume_url} onChange={(e) => set("resume_url", e.target.value)} placeholder="paste a URL, or upload →" />
              <label className="shrink-0 cursor-pointer whitespace-nowrap rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
                {resumeBusy ? "Uploading…" : "Upload"}
                <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadResume(f); e.currentTarget.value = ""; }} />
              </label>
            </div>
            <p className="mt-1 text-xs text-muted">Optional · max 4 MB</p>
          </div>
        </div>
      )}

      {checking && <p className="mt-2 text-xs text-muted">Checking for duplicates…</p>}
      {dupes.length > 0 && (
        <div className="mt-3 rounded-xl border border-warning-600/40 bg-warning-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-warning-600">
            ⚠ Possible duplicate{dupes.length > 1 ? "s" : ""} — this candidate may already be submitted
          </div>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {dupes.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium">{h.candidate_name}</span>
                <span className="text-muted">· {h.recruiter} · {h.requirement} · {h.status} · {h.submitted_date}</span>
                <span className="rounded bg-warning-600/15 px-1.5 py-0.5 text-[11px] text-warning-600">matched {h.matchedOn.join(" + ")}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">You can still add this candidate — this is just a heads-up to avoid double-submitting to a client.</p>
        </div>
      )}

      {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted">{visible.length} submission{visible.length === 1 ? "" : "s"}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select value={reqFilter} onChange={(e) => setReqFilter(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm">
            <option value="all">All requirements</option>
            {requirements.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search candidate or role…" className="h-9 w-60 rounded-lg border border-line bg-surface px-3 text-sm" />
        </div>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted">
            <tr><th className="py-2">Candidate</th><th>LinkedIn</th><th>Requirement</th><th>Submitted</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {visible.map((s) => <SubRow key={s.id} s={s} statuses={statuses} />)}
            {visible.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-muted">{submissions.length === 0 ? "No candidates submitted yet — add your first above." : "No submissions match your search."}</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SubRow({ s, statuses }: { s: Sub; statuses: SubmissionStatus[] }) {
  const cur = statuses.find((st) => st.id === s.current_status_id);
  const [name, setName] = useState(s.candidate_name);
  const [date, setDate] = useState(s.submitted_date?.slice(0, 10) ?? "");
  const [removed, setRemoved] = useState(false);
  if (removed) return null;

  const meta = [s.current_title, s.current_company, s.total_experience != null ? `${s.total_experience} yrs` : null, s.current_location]
    .filter(Boolean).join(" · ");

  async function saveName() { if (name !== s.candidate_name) await updateSubmissionName(s.id, name); }
  async function saveDate(iso: string) { if (!iso) return; setDate(iso); await updateSubmissionDate(s.id, iso); }
  async function move(newStatus: string) { await updateSubmissionStatus(s.id, newStatus); }
  async function remove() {
    if (!confirm(`Delete submission for ${s.candidate_name}?`)) return;
    const res = await deleteSubmission(s.id);
    if (res.ok) setRemoved(true);
  }

  return (
    <tr className="border-t border-line align-top">
      <td className="py-2">
        <div className="flex items-start gap-2">
          <Avatar name={s.candidate_name} src={s.candidate_photo_url} size={30} />
          <div className="min-w-0 flex-1">
            <input className="w-full rounded border border-transparent px-1 py-0.5 hover:border-line focus:border-line focus:outline-none" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
            {(meta || s.resume_url) && (
              <div className="px-1 text-xs text-muted">
                {meta}
                {s.resume_url && <> · <a href={s.resume_url} target="_blank" rel="noreferrer" className="text-brand-700 underline">resume</a></>}
              </div>
            )}
          </div>
        </div>
      </td>
      <td>{s.linkedin_url ? <a href={s.linkedin_url} target="_blank" rel="noreferrer" className="text-brand-700 underline">link</a> : "—"}</td>
      <td>{s.requirements?.title ?? "—"}</td>
      <td><input type="date" value={date} onChange={(e) => saveDate(e.target.value)} className="rounded border border-line bg-surface px-1.5 py-0.5 text-xs" /></td>
      <td>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${cur?.counts_as_closure ? "bg-success-600" : cur?.is_rejection ? "bg-danger-600" : "bg-brand-600"}`} />
          <select defaultValue={s.current_status_id} className="rounded-lg border border-line px-2 py-1 text-sm" onChange={(e) => move(e.target.value)}>
            {statuses.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
          </select>
        </div>
      </td>
      <td><button onClick={remove} className="text-xs text-danger-600 underline">delete</button></td>
    </tr>
  );
}
