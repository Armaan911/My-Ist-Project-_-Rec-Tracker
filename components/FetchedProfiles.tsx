"use client";
import { useState } from "react";
import { Card, Modal } from "@/components/ui";
import { toast } from "@/components/uikit";
import { createClient } from "@/lib/supabase/client";
import { FETCHED_STATUSES, statusLabel, statusColor } from "@/lib/fetchedProfiles";
import { updateFetchedStatus, setFetchedResume, setFetchedComment } from "@/app/dashboard/fetched-actions";
import { usePaged, Pager } from "@/components/Pager";

type FP = {
  id: string; candidate_name: string | null; linkedin_url: string | null; location: string | null;
  email: string | null; phone: string | null; open_to_work: boolean | null; ownership: string | null;
  status: string; resume_url: string | null; requirement_title: string | null; recruiter_comment: string | null;
};

export default function FetchedProfiles({ items }: { items: FP[] }) {
  const [list, setList] = useState<FP[]>(items);
  const [open, setOpen] = useState<FP | null>(null);
  const pg = usePaged(list, 20);
  if (list.length === 0) return null;

  function patch(id: string, p: Partial<FP>) {
    setList((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
    setOpen((o) => (o && o.id === id ? { ...o, ...p } : o));
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">AI-team fetched profiles</h2>
      <p className="mb-3 text-sm text-muted">Sourced by the AI team and assigned to you. Click a row for full details, add a resume, and keep the status updated.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted"><tr><th className="py-2 pr-3">Candidate</th><th className="pr-3">Requirement</th><th className="pr-3">Location</th><th>Status</th></tr></thead>
          <tbody>
            {pg.slice.map((p) => (
              <tr key={p.id} onClick={() => setOpen(p)} className="cursor-pointer border-t border-line hover:bg-brand-50/40">
                <td className="py-2 pr-3 font-medium">{p.candidate_name ?? "—"}</td>
                <td className="pr-3 text-muted">{p.requirement_title ?? "—"}</td>
                <td className="pr-3 text-muted">{p.location ?? "—"}</td>
                <td><span className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: statusColor(p.status), background: statusColor(p.status) + "1a" }}>{statusLabel(p.status)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={pg.page} pageCount={pg.pageCount} setPage={pg.setPage} total={pg.total} pageSize={pg.pageSize} />
      {open && <DetailModal p={open} onClose={() => setOpen(null)} onPatch={patch} />}
    </Card>
  );
}

function DetailModal({ p, onClose, onPatch }: { p: FP; onClose: () => void; onPatch: (id: string, patch: Partial<FP>) => void }) {
  const [uploading, setUploading] = useState(false);
  const [comment, setComment] = useState(p.recruiter_comment ?? "");
  const [savingComment, setSavingComment] = useState(false);
  async function saveComment() {
    setSavingComment(true);
    const res = await setFetchedComment(p.id, comment);
    setSavingComment(false);
    if (!res.ok) { toast(res.error ?? "Failed to save", "error"); return; }
    onPatch(p.id, { recruiter_comment: comment.trim() || null });
    toast("Comment saved", "success");
  }

  async function changeStatus(status: string) {
    onPatch(p.id, { status });
    const res = await updateFetchedStatus(p.id, status);
    if (!res.ok) toast(res.error ?? "Failed", "error");
    else toast("Status updated — AI team notified", "success");
  }
  async function upload(f: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = (f.name.split(".").pop() || "pdf").toLowerCase();
      const path = `fetched/${p.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("candidates").upload(path, f, { upsert: true });
      if (error) { toast(error.message, "error"); return; }
      const { data } = supabase.storage.from("candidates").getPublicUrl(path);
      const res = await setFetchedResume(p.id, data.publicUrl);
      if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
      onPatch(p.id, { resume_url: data.publicUrl });
      toast("Resume saved", "success");
    } finally { setUploading(false); }
  }
  async function removeResume() {
    const res = await setFetchedResume(p.id, null);
    if (!res.ok) { toast(res.error ?? "Failed to remove", "error"); return; }
    onPatch(p.id, { resume_url: null });
    toast("Resume removed", "success");
  }

  return (
    <Modal open onClose={onClose} wide title={p.candidate_name ?? "Candidate"} description={p.requirement_title ?? undefined}>
      <div className="space-y-4 text-sm">
        <Field label="LinkedIn" value={p.linkedin_url ? <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="break-all text-brand-700 underline">{p.linkedin_url}</a> : "—"} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" value={p.email ?? "—"} />
          <Field label="Phone" value={p.phone ?? "—"} />
          <Field label="Location" value={p.location ?? "—"} />
          <Field label="Open to work" value={p.open_to_work == null ? "—" : p.open_to_work ? "Yes" : "No"} />
          <Field label="Ownership" value={p.ownership ?? "—"} />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-muted">Status</div>
          <select defaultValue={p.status} onChange={(e) => changeStatus(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm">
            {FETCHED_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-muted">Resume / CV</div>
          <div className="flex flex-wrap items-center gap-3">
            {p.resume_url && <a href={p.resume_url} target="_blank" rel="noreferrer" className="text-sm text-brand-700 underline">View current</a>}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas">
              {uploading ? "Uploading…" : p.resume_url ? "Replace resume" : "Upload resume"}
              <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            </label>
            {p.resume_url && (
              <button onClick={removeResume} className="rounded-lg border border-danger-600/30 px-3 py-1.5 text-sm text-danger-600 hover:bg-danger-50">Remove resume</button>
            )}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-muted">Your comment</div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Notes on this candidate (visible to the AI team)…" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-brand-600 focus:outline-none" />
          <div className="mt-2 flex justify-end">
            <button onClick={saveComment} disabled={savingComment || comment === (p.recruiter_comment ?? "")} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40">{savingComment ? "Saving…" : "Save comment"}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-xs font-medium text-muted">{label}</div><div className="break-words">{value}</div></div>;
}
