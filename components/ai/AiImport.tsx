"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Label } from "@/components/ui";
import { toast } from "@/components/uikit";
import { importFetchedProfiles, previewFetched } from "@/app/ai/actions";
import type { FetchedRow } from "@/lib/fetchedProfiles";

type Req = { id: string; title: string; job_code: string | null; client: string | null };
type Rec = { id: string; full_name: string };

export default function AiImport({ requirements, recruiters }: { requirements: Req[]; recruiters: Rec[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"link" | "file">("link");
  const [link, setLink] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [reqId, setReqId] = useState("");
  const [pocs, setPocs] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<FetchedRow[] | null>(null);

  const jd = requirements.find((r) => r.id === reqId);
  const jdLabel = jd ? `${jd.title}${jd.client ? ` · ${jd.client}` : ""}` : "No requirement selected";

  function togglePoc(id: string) { setPocs((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); }
  function onFile(f: File) {
    setFileName(f.name); setPreview(null);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(f);
  }
  function reset() {
    setLink(""); setCsvText(""); setFileName(""); setPocs([]); setPreview(null);
  }

  async function doPreview() {
    if (mode === "link" && !link.trim()) { toast("Paste a sheet/CSV link", "error"); return; }
    if (mode === "file" && !csvText) { toast("Choose a CSV file", "error"); return; }
    setParsing(true);
    const res = await previewFetched({ link: mode === "link" ? link : undefined, csvText: mode === "file" ? csvText : undefined });
    setParsing(false);
    if (!res.ok) { toast(res.error ?? "Couldn't parse", "error"); return; }
    setPreview(res.rows);
  }

  async function doImport() {
    if (pocs.length === 0) { toast("Pick at least one POC recruiter", "error"); return; }
    const missingLi = (preview ?? []).filter((r) => !r.linkedin_url).length;
    if (missingLi > 0) { toast(`Every candidate needs a LinkedIn URL — ${missingLi} missing. Fix the sheet and re-parse.`, "error"); return; }
    setImporting(true);
    const res = await importFetchedProfiles({
      link: mode === "link" ? link : undefined,
      csvText: mode === "file" ? csvText : undefined,
      requirementId: reqId || null, pocIds: pocs,
    });
    setImporting(false);
    if (!res.ok) { toast(res.error ?? "Import failed", "error"); return; }
    toast(`Imported ${res.count} candidate${res.count === 1 ? "" : "s"} → assigned to ${pocs.length} recruiter${pocs.length === 1 ? "" : "s"}`, "success");
    reset();
    router.refresh();
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Import candidates</h2>
      <p className="mb-3 text-sm text-muted">Expected columns: name, linkedin url, location, email, phone, open2work, ownership.</p>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex w-fit rounded-lg border border-line p-0.5 text-sm">
            {(["link", "file"] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setPreview(null); }} className={`rounded-md px-3 py-1 ${mode === m ? "bg-brand-600 text-white" : "text-muted hover:text-ink"}`}>
                {m === "link" ? "Sheet / CSV link" : "Upload CSV"}
              </button>
            ))}
          </div>
          {mode === "link" ? (
            <div>
              <Label>Google Sheet or CSV link</Label>
              <Input value={link} onChange={(e) => { setLink(e.target.value); setPreview(null); }} placeholder="https://docs.google.com/spreadsheets/…" />
              <p className="mt-1 text-xs text-muted">Share the sheet as “anyone with the link” so it can be read.</p>
            </div>
          ) : (
            <div>
              <Label>CSV file</Label>
              <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} className="block w-full text-sm" />
              {fileName && <p className="mt-1 text-xs text-muted">{fileName} loaded</p>}
            </div>
          )}
          <div>
            <Label>Requirement / JD (optional)</Label>
            <select value={reqId} onChange={(e) => setReqId(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm">
              <option value="">— none —</option>
              {requirements.map((r) => <option key={r.id} value={r.id}>{r.title}{r.client ? ` · ${r.client}` : ""}</option>)}
            </select>
          </div>
        </div>
        <div>
          <Label>Assign to POC recruiter(s)</Label>
          <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-auto sm:grid-cols-2">
            {recruiters.map((r) => {
              const on = pocs.includes(r.id);
              return (
                <button key={r.id} type="button" onClick={() => togglePoc(r.id)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${on ? "border-brand-600 bg-brand-50" : "border-line hover:bg-canvas"}`}>
                  <span className={`grid h-4 w-4 place-items-center rounded border text-[10px] text-white ${on ? "border-brand-600 bg-brand-600" : "border-line"}`}>{on ? "✓" : ""}</span>
                  {r.full_name}
                </button>
              );
            })}
            {recruiters.length === 0 && <p className="text-sm text-muted">No recruiters available.</p>}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button disabled={parsing} onClick={doPreview}>{parsing ? "Parsing…" : "Parse & preview"}</Button>
      </div>

      {preview && (
        <div className="mt-5 rounded-xl border border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-2.5">
            <div className="text-sm">
              <span className="font-semibold">{preview.length}</span> candidate{preview.length === 1 ? "" : "s"} parsed for{" "}
              <span className="font-semibold text-brand-700">{jdLabel}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {preview.some((r) => !r.linkedin_url) && <span className="font-semibold text-danger-600">⚠ {preview.filter((r) => !r.linkedin_url).length} missing LinkedIn</span>}
              <span className="text-muted">All will start at “Yet to review”.</span>
            </div>
          </div>
          <div className="max-h-[55vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Candidate</th>
                  <th className="px-3 py-2 font-medium">LinkedIn</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Open to work</th>
                  <th className="px-3 py-2 font-medium">Ownership</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-line/60 align-top">
                    <td className="px-3 py-2 text-muted">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{r.candidate_name ?? "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.linkedin_url ? <a href={r.linkedin_url} target="_blank" rel="noreferrer" className="text-brand-700 underline">link</a> : <span className="font-medium text-danger-600">missing</span>}</td>
                    <td className="px-3 py-2 text-muted">{r.location ?? "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.email ?? "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.phone ?? "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.open_to_work == null ? "—" : r.open_to_work ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 text-muted">{r.ownership ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
            <button onClick={reset} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">Start over</button>
            <Button disabled={importing} onClick={doImport}>{importing ? "Importing…" : `Import & assign${pocs.length ? ` to ${pocs.length} recruiter${pocs.length === 1 ? "" : "s"}` : ""}`}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
