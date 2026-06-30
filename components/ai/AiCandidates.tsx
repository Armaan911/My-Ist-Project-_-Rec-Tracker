"use client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { toast } from "@/components/uikit";
import { createClient } from "@/lib/supabase/client";
import { FETCHED_STATUSES, statusColor, statusLabel } from "@/lib/fetchedProfiles";
import { aiUpdateProfile, aiSetResume, aiDeleteProfiles } from "@/app/ai/actions";
import { usePaged, Pager } from "@/components/Pager";

type FP = {
  id: string; candidate_name: string | null; linkedin_url: string | null; location: string | null;
  email: string | null; phone: string | null; open_to_work: boolean | null; ownership: string | null;
  status: string; resume_url: string | null; requirement_id: string | null; requirement_title: string | null;
  created_at: string | null; recruiter_comment: string | null;
};

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export default function AiCandidates({ candidates }: { candidates: FP[] }) {
  const [rows, setRows] = useState<FP[]>(candidates);
  const [query, setQuery] = useState("");
  const [jd, setJd] = useState("");      // "" = none selected, else requirement_id | "none"
  const [status, setStatus] = useState("all");

  const jds = useMemo(() => {
    const m = new Map<string, string>(); let hasNone = false;
    for (const r of rows) { if (r.requirement_id) m.set(r.requirement_id, r.requirement_title ?? "Untitled JD"); else hasNone = true; }
    const list = [...m.entries()].map(([id, title]) => ({ id, title }));
    if (hasNone) list.push({ id: "none", title: "No JD" });
    return list;
  }, [rows]);

  const q = query.trim().toLowerCase();
  const show = jd !== "" || q !== "";
  const filtered = useMemo(() => (!show ? [] : rows.filter((r) => {
    if (jd !== "" && (jd === "none" ? !!r.requirement_id : r.requirement_id !== jd)) return false;
    if (status !== "all" && r.status !== status) return false;
    if (q) {
      const hay = [r.candidate_name, r.email, r.location, r.ownership, r.phone, r.linkedin_url, r.requirement_title, statusLabel(r.status)]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  })), [rows, jd, status, q, show]);
  const pg = usePaged(filtered, 20);

  function patch(id: string, p: Partial<FP>) { setRows((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x))); }
  async function deleteRows(ids: string[]) {
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} candidate${ids.length === 1 ? "" : "s"}? This can't be undone.`)) return;
    const res = await aiDeleteProfiles(ids);
    if (!res.ok) { toast(res.error ?? "Delete failed", "error"); return; }
    setRows((xs) => xs.filter((x) => !ids.includes(x.id)));
    toast(`Deleted ${res.count} candidate${res.count === 1 ? "" : "s"}`, "success");
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Parsed candidates</h2>
          <p className="text-sm text-muted">Search or pick a job role to view candidates. Click any cell to edit.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search candidates or job role…" className="h-9 w-56 rounded-lg border border-line bg-surface px-3 text-sm" />
          <select value={jd} onChange={(e) => setJd(e.target.value)} className="h-9 min-w-[12rem] rounded-lg border border-line bg-surface px-2 text-sm">
            <option value="">— select a job role —</option>
            {jds.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
          </select>
          {show && (
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm">
              <option value="all">All statuses</option>
              {FETCHED_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}
          {show && filtered.length > 0 && (
            <button onClick={() => deleteRows(filtered.map((r) => r.id))} className="h-9 rounded-lg border border-danger-600/40 px-3 text-sm font-medium text-danger-600 hover:bg-danger-50">Delete {filtered.length} shown</button>
          )}
        </div>
      </div>

      {!show ? (
        <p className="py-10 text-center text-sm text-muted">Pick a job role or type in the search box to view candidates.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  {["Name", "LinkedIn", "Parsed on", "Location", "Email", "Phone", "Open2work", "Status", "Ownership", "Resume", ""].map((h, i) => (
                    <th key={i} className="px-2 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pg.slice.map((r) => <AiRow key={r.id} r={r} onPatch={patch} onDelete={() => deleteRows([r.id])} />)}
                {filtered.length === 0 && <tr><td colSpan={11} className="py-6 text-center text-muted">No candidates for this job role / filter.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={pg.page} pageCount={pg.pageCount} setPage={pg.setPage} total={pg.total} pageSize={pg.pageSize} />
        </>
      )}
    </Card>
  );
}

function AiRow({ r, onPatch, onDelete }: { r: FP; onPatch: (id: string, p: Partial<FP>) => void; onDelete: () => void }) {
  const [uploading, setUploading] = useState(false);

  async function saveField(field: keyof FP, value: any) {
    if ((r as any)[field] === value) return;
    if (field === "linkedin_url" && !value) { toast("LinkedIn URL is required", "error"); return; }
    onPatch(r.id, { [field]: value } as Partial<FP>);
    const res = await aiUpdateProfile(r.id, { [field]: value });
    if (!res.ok) toast(res.error ?? "Save failed", "error");
  }
  async function uploadResume(f: File) {
    if (f.size > 4 * 1024 * 1024) { toast("Resume must be under 4 MB.", "error"); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = (f.name.split(".").pop() || "pdf").toLowerCase();
      const path = `fetched/${r.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("candidates").upload(path, f, { upsert: true });
      if (error) { toast(error.message, "error"); return; }
      const { data } = supabase.storage.from("candidates").getPublicUrl(path);
      const res = await aiSetResume(r.id, data.publicUrl);
      if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
      onPatch(r.id, { resume_url: data.publicUrl }); toast("Resume saved", "success");
    } finally { setUploading(false); }
  }
  async function removeResume() {
    const res = await aiSetResume(r.id, null);
    if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
    onPatch(r.id, { resume_url: null }); toast("Resume removed", "success");
  }

  const cell = "border-t border-line/60 px-2 py-1.5 align-top";
  const inp = "w-full min-w-[6.5rem] rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-line focus:border-brand-600 focus:bg-surface focus:outline-none";
  const liMissing = !r.linkedin_url;

  return (
    <tr>
      <td className={cell}>
        <div className="flex items-center gap-1">
          <input defaultValue={r.candidate_name ?? ""} onBlur={(e) => saveField("candidate_name", e.target.value || null)} className={`${inp} font-medium`} placeholder="—" />
          {r.recruiter_comment && <span title={`Recruiter note: ${r.recruiter_comment}`} className="shrink-0 cursor-help">💬</span>}
        </div>
      </td>
      <td className={cell}>
        <div className="flex items-center gap-1">
          <input defaultValue={r.linkedin_url ?? ""} onBlur={(e) => saveField("linkedin_url", e.target.value || null)} className={`${inp} ${liMissing ? "border-danger-600/60 bg-danger-50/40" : ""}`} placeholder="required" />
          {r.linkedin_url && <a href={r.linkedin_url} target="_blank" rel="noreferrer" title="Open LinkedIn" className="shrink-0 text-brand-700 hover:underline">↗</a>}
        </div>
      </td>
      <td className={`${cell} whitespace-nowrap text-muted`}>{fmtDate(r.created_at)}</td>
      <td className={cell}><input defaultValue={r.location ?? ""} onBlur={(e) => saveField("location", e.target.value || null)} className={inp} placeholder="—" /></td>
      <td className={cell}><input defaultValue={r.email ?? ""} onBlur={(e) => saveField("email", e.target.value || null)} className={inp} placeholder="—" /></td>
      <td className={cell}><input defaultValue={r.phone ?? ""} onBlur={(e) => saveField("phone", e.target.value || null)} className={inp} placeholder="—" /></td>
      <td className={cell}>
        <select defaultValue={r.open_to_work == null ? "" : r.open_to_work ? "yes" : "no"} onChange={(e) => saveField("open_to_work", e.target.value === "" ? null : e.target.value === "yes")} className={inp}>
          <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
        </select>
      </td>
      <td className={cell}>
        <select value={r.status} onChange={(e) => saveField("status", e.target.value)}
          className="rounded-full border-0 px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1"
          style={{ color: statusColor(r.status), background: statusColor(r.status) + "1a" }}>
          {FETCHED_STATUSES.map((s) => <option key={s.value} value={s.value} style={{ color: "#111827" }}>{s.label}</option>)}
        </select>
      </td>
      <td className={cell}><input defaultValue={r.ownership ?? ""} onBlur={(e) => saveField("ownership", e.target.value || null)} className={inp} placeholder="—" /></td>
      <td className={cell}>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {r.resume_url && <a href={r.resume_url} target="_blank" rel="noreferrer" className="text-xs text-brand-700 underline">view</a>}
          <label className="cursor-pointer rounded border border-line px-1.5 py-0.5 text-xs hover:bg-canvas">
            {uploading ? "…" : r.resume_url ? "replace" : "upload"}
            <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadResume(f); }} />
          </label>
          {r.resume_url && <button onClick={removeResume} className="rounded border border-danger-600/30 px-1.5 py-0.5 text-xs text-danger-600 hover:bg-danger-50">delete</button>}
        </div>
      </td>
      <td className={`${cell} whitespace-nowrap`}>
        <button onClick={onDelete} title="Delete candidate" className="rounded border border-danger-600/30 px-1.5 py-0.5 text-xs font-medium text-danger-600 hover:bg-danger-50">Delete</button>
      </td>
    </tr>
  );
}
