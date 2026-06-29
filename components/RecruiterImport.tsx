"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Label } from "@/components/ui";
import { toast } from "@/components/uikit";
import { previewSubmissionImport, importPreviousSubmissions, type ParsedSubRow } from "@/app/dashboard/submission-import-actions";

type Req = { id: string; title: string; job_code?: string | null };
type St = { id: string; label: string };

export default function RecruiterImport({ requirements, statuses }: { requirements: Req[]; statuses: St[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"link" | "file">("link");
  const [link, setLink] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [reqId, setReqId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParsedSubRow[] | null>(null);

  function onFile(f: File) { setFileName(f.name); setPreview(null); const r = new FileReader(); r.onload = () => setCsvText(String(r.result ?? "")); r.readAsText(f); }
  function reset() { setLink(""); setCsvText(""); setFileName(""); setPreview(null); }

  async function doPreview() {
    if (mode === "link" && !link.trim()) { toast("Paste a sheet/CSV link", "error"); return; }
    if (mode === "file" && !csvText) { toast("Choose a CSV file", "error"); return; }
    setParsing(true);
    const res = await previewSubmissionImport({ link: mode === "link" ? link : undefined, csvText: mode === "file" ? csvText : undefined });
    setParsing(false);
    if (!res.ok) { toast(res.error ?? "Couldn't parse", "error"); return; }
    setPreview(res.rows);
  }
  async function doImport() {
    if (!reqId) { toast("Pick a requirement", "error"); return; }
    if (!statusId) { toast("Pick a default status", "error"); return; }
    setImporting(true);
    const res = await importPreviousSubmissions({ link: mode === "link" ? link : undefined, csvText: mode === "file" ? csvText : undefined, requirementId: reqId, defaultStatusId: statusId });
    setImporting(false);
    if (!res.ok) { toast(res.error ?? "Import failed", "error"); return; }
    toast(`Recorded ${res.count} submission${res.count === 1 ? "" : "s"}`, "success");
    reset(); router.refresh();
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Import past submissions</h2>
      <p className="mb-3 text-sm text-muted">Record older submissions from a sheet. Expected columns: name, email, date, status (status optional).</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex w-fit rounded-lg border border-line p-0.5 text-sm">
            {(["link", "file"] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setPreview(null); }} className={`rounded-md px-3 py-1 ${mode === m ? "bg-brand-600 text-white" : "text-muted hover:text-ink"}`}>{m === "link" ? "Sheet / CSV link" : "Upload CSV"}</button>
            ))}
          </div>
          {mode === "link" ? (
            <div><Label>Google Sheet or CSV link</Label><Input value={link} onChange={(e) => { setLink(e.target.value); setPreview(null); }} placeholder="https://docs.google.com/spreadsheets/…" /><p className="mt-1 text-xs text-muted">Share as “anyone with the link”.</p></div>
          ) : (
            <div><Label>CSV file</Label><input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} className="block w-full text-sm" />{fileName && <p className="mt-1 text-xs text-muted">{fileName} loaded</p>}</div>
          )}
        </div>
        <div className="space-y-3">
          <div><Label>Requirement</Label>
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

      {preview && (
        <div className="mt-5 rounded-xl border border-line">
          <div className="border-b border-line bg-canvas px-4 py-2.5 text-sm"><b>{preview.length}</b> submission{preview.length === 1 ? "" : "s"} parsed</div>
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted"><tr><th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">Candidate</th><th className="px-3 py-2 font-medium">Email</th><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="px-3 py-2 text-muted">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{r.candidate_name}</td>
                    <td className="px-3 py-2 text-muted">{r.email ?? "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.date ?? "today"}</td>
                    <td className="px-3 py-2 text-muted">{r.status ?? "default"}</td>
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
    </Card>
  );
}
