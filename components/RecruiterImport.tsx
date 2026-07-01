"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Label } from "@/components/ui";
import { toast } from "@/components/uikit";
import { createClient } from "@/lib/supabase/client";
import { previewSubmissionImport, importPreviousSubmissions, setSubmissionResume, setSubmissionDate, type ParsedSubRow, type ImportedSub } from "@/app/dashboard/submission-import-actions";

type Req = { id: string; title: string; job_code?: string | null };
type St = { id: string; label: string };

const PAGE = 20;
function fmtDMY(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || "—");
}

export default function RecruiterImport({ requirements, statuses }: { requirements: Req[]; statuses: St[] }) {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [fileB64, setFileB64] = useState("");
  const [fileName, setFileName] = useState("");
  const [reqId, setReqId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParsedSubRow[] | null>(null);
  const [imported, setImported] = useState<ImportedSub[] | null>(null);

  function onFile(f: File) {
    setFileName(f.name); setPreview(null); setImported(null);
    if (f.name.toLowerCase().endsWith(".xlsx")) {
      setCsvText("");
      const r = new FileReader();
      r.onload = () => { const res = String(r.result || ""); setFileB64(res.includes(",") ? res.split(",")[1] : res); };
      r.readAsDataURL(f);
    } else {
      setFileB64("");
      const r = new FileReader();
      r.onload = () => setCsvText(String(r.result ?? ""));
      r.readAsText(f);
    }
  }
  function reset() { setCsvText(""); setFileB64(""); setFileName(""); setPreview(null); setImported(null); }
  const payload = () => ({ csvText: csvText || undefined, fileB64: fileB64 || undefined, fileName });

  async function doPreview() {
    if (!csvText && !fileB64) { toast("Choose a CSV or Excel (.xlsx) file", "error"); return; }
    setParsing(true);
    const res = await previewSubmissionImport(payload());
    setParsing(false);
    if (!res.ok) { toast(res.error ?? "Couldn't parse", "error"); return; }
    setPreview(res.rows);
  }
  async function doImport() {
    if (!reqId) { toast("Pick a default requirement", "error"); return; }
    if (!statusId) { toast("Pick a default status", "error"); return; }
    setImporting(true);
    const res = await importPreviousSubmissions({ ...payload(), requirementId: reqId, defaultStatusId: statusId });
    setImporting(false);
    if (!res.ok) { toast(res.error ?? "Import failed", "error"); return; }
    toast(`Recorded ${res.count} submission${res.count === 1 ? "" : "s"}${res.skipped ? ` · ${res.skipped} duplicate${res.skipped === 1 ? "" : "s"} skipped` : ""}`, res.skipped ? "default" : "success");
    setPreview(null); setImported(res.rows); router.refresh();
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Import past submissions</h2>
      <p className="mb-3 text-sm text-muted">Upload a CSV or Excel (.xlsx). Columns auto-map by header (name, linkedin url, location, email, phone, status, date, job code). A row's <b>job code</b> assigns it to that requirement; rows without one use the default below.</p>

      {!imported && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <Label>CSV or Excel file</Label>
                <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} className="block w-full text-sm" />
                {fileName && <p className="mt-1 text-xs text-muted">{fileName} loaded</p>}
              </div>
            </div>
            <div className="space-y-3">
              <div><Label>Default requirement (for rows with no job code)</Label>
                <select value={reqId} onChange={(e) => setReqId(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm">
                  <option value="">— select —</option>
                  {requirements.map((r) => <option key={r.id} value={r.id}>{r.title}{r.job_code ? ` · ${r.job_code}` : ""}</option>)}
                </select>
              </div>
              <div><Label>Default status (for rows without one)</Label>
                <select value={statusId} onChange={(e) => setStatusId(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm">
                  <option value="">— select —</option>
                  {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end"><Button disabled={parsing} onClick={doPreview}>{parsing ? "Parsing…" : "Parse & preview"}</Button></div>
        </>
      )}

      {preview && !imported && (
        <div className="mt-5 rounded-xl border border-line">
          <div className="border-b border-line bg-canvas px-4 py-2.5 text-sm"><b>{preview.length}</b> row{preview.length === 1 ? "" : "s"} parsed</div>
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted"><tr>{["Name", "LinkedIn", "Location", "Email", "Phone", "Job code", "Status", "Date"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="px-3 py-2 font-medium">{r.candidate_name}</td>
                    <td className="px-3 py-2 text-muted">{r.linkedin ? <a href={r.linkedin} target="_blank" rel="noreferrer" className="text-brand-700 underline">link</a> : "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.location ?? "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.email ?? "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.phone ?? "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.job_code ?? "default"}</td>
                    <td className="px-3 py-2 text-muted">{r.status ?? "default"}</td>
                    <td className="px-3 py-2 text-muted">{r.date ? fmtDMY(r.date) : "today"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
            <button onClick={reset} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">Start over</button>
            <Button disabled={importing} onClick={doImport}>{importing ? "Importing…" : "Record submissions"}</Button>
          </div>
        </div>
      )}

      {imported && <ImportedTable rows={imported} onReset={reset} />}
    </Card>
  );
}

function ImportedTable({ rows, onReset }: { rows: ImportedSub[]; onReset: () => void }) {
  const [reqFilter, setReqFilter] = useState("all");
  const [page, setPage] = useState(0);
  const reqOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.requirement))).sort(), [rows]);
  const filtered = reqFilter === "all" ? rows : rows.filter((r) => r.requirement === reqFilter);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const shown = filtered.slice(cur * PAGE, cur * PAGE + PAGE);

  return (
    <div className="mt-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted"><b>{rows.length}</b> recorded — cells are read-only; edit the date or upload a resume per row.</p>
        <div className="flex items-center gap-2">
          <select value={reqFilter} onChange={(e) => { setReqFilter(e.target.value); setPage(0); }} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm">
            <option value="all">All requirements ({rows.length})</option>
            {reqOptions.map((r) => <option key={r} value={r}>{r} ({rows.filter((x) => x.requirement === r).length})</option>)}
          </select>
          <button onClick={onReset} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">Import another</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wide text-muted"><tr>{["Name", "LinkedIn", "Location", "Email", "Phone", "Requirement", "Status", "Submitted", "Resume"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{shown.map((r) => <ImportedRow key={r.id} r={r} />)}</tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-2 flex items-center justify-end gap-2 text-sm">
          <button disabled={cur === 0} onClick={() => setPage(cur - 1)} className="rounded border border-line px-2 py-1 disabled:opacity-40">Prev</button>
          <span className="text-muted">Page {cur + 1} of {pages}</span>
          <button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="rounded border border-line px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

function ImportedRow({ r }: { r: ImportedSub }) {
  const [resume, setResume] = useState<string | null>(r.resume_url);
  const [date, setDate] = useState(r.submitted_date);
  const [busy, setBusy] = useState(false);

  async function upload(f: File) {
    if (f.size > 4 * 1024 * 1024) { toast("Resume must be under 4 MB.", "error"); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const ext = (f.name.split(".").pop() || "pdf").toLowerCase();
      const path = `submissions/${r.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("candidates").upload(path, f, { upsert: true });
      if (error) { toast(error.message, "error"); return; }
      const { data } = supabase.storage.from("candidates").getPublicUrl(path);
      const res = await setSubmissionResume(r.id, data.publicUrl);
      if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
      setResume(data.publicUrl); toast("Resume saved", "success");
    } finally { setBusy(false); }
  }
  async function changeDate(iso: string) {
    if (!iso) return;
    setDate(iso);
    const res = await setSubmissionDate(r.id, iso);
    if (!res.ok) toast(res.error ?? "Couldn't update date", "error");
  }
  const cell = "border-t border-line/60 px-3 py-2 text-muted";
  return (
    <tr>
      <td className="border-t border-line/60 px-3 py-2 font-medium">{r.candidate_name}</td>
      <td className={cell}>{r.linkedin_url ? <a href={r.linkedin_url} target="_blank" rel="noreferrer" className="text-brand-700 underline">link</a> : "—"}</td>
      <td className={cell}>{r.location ?? "—"}</td>
      <td className={cell}>{r.email ?? "—"}</td>
      <td className={cell}>{r.phone ?? "—"}</td>
      <td className={cell}>{r.requirement}</td>
      <td className={cell}>{r.status}</td>
      <td className="border-t border-line/60 px-3 py-2">
        <input type="date" value={date} onChange={(e) => changeDate(e.target.value)} title={fmtDMY(date)}
          className="rounded border border-line bg-surface px-1.5 py-0.5 text-xs" />
      </td>
      <td className="border-t border-line/60 px-3 py-2">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {resume && <a href={resume} target="_blank" rel="noreferrer" className="text-xs text-brand-700 underline">view</a>}
          <label className="cursor-pointer rounded border border-line px-1.5 py-0.5 text-xs hover:bg-canvas">
            {busy ? "…" : resume ? "replace" : "upload"}
            <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }} />
          </label>
        </div>
      </td>
    </tr>
  );
}
