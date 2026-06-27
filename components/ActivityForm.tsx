"use client";

import { useState } from "react";
import { saveActivity } from "@/app/activity/actions";
import { Button, Card, Input, Label } from "@/components/ui";

type Req = { id: string; title: string };

const today = () => new Date().toISOString().slice(0, 10);

export default function ActivityForm({ initial, requirements = [] }: { initial?: any; requirements?: Req[] }) {
  const [date, setDate] = useState<string>(initial?.activity_date ?? today());
  const [resumes, setResumes] = useState<number>(initial?.resumes_sourced ?? 0);
  const [parsed, setParsed] = useState<number>(initial?.applicants_parsed ?? 0);
  const [internalSubs, setInternalSubs] = useState<number>(initial?.internal_submissions ?? 0);
  const [clientSubs, setClientSubs] = useState<number>(initial?.client_submissions ?? 0);
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true); setMsg(null);
    const res = await saveActivity({
      activity_date: date,
      resumes_sourced: Number(resumes),
      applicants_parsed: Number(parsed),
      internal_submissions: Number(internalSubs),
      client_submissions: Number(clientSubs),
      notes,
    });
    setSaving(false);
    if (!res.ok) setMsg("Error: " + res.error);
    else if (res.queued) setMsg("That day is locked — sent to admin for approval.");
    else setMsg("Saved.");
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Daily update</h2>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div />
        <div><Label>Resumes sourced</Label><Input type="number" min={0} value={resumes} onChange={(e) => setResumes(+e.target.value)} /></div>
        <div><Label>Applicants parsed</Label><Input type="number" min={0} value={parsed} onChange={(e) => setParsed(+e.target.value)} /></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-line bg-canvas/50 p-3">
        <div className="col-span-2 -mb-1 text-xs font-medium uppercase tracking-wide text-muted">Today&apos;s submissions</div>
        <div><Label>Internal submissions</Label><Input type="number" min={0} value={internalSubs} onChange={(e) => setInternalSubs(+e.target.value)} /></div>
        <div><Label>Client submissions</Label><Input type="number" min={0} value={clientSubs} onChange={(e) => setClientSubs(+e.target.value)} /></div>
      </div>
      <div className="mt-4">
        <Label>What you worked on</Label>
        {requirements.length > 0 ? (
          <select
            className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          >
            <option value="">Select a requirement…</option>
            {requirements.map((r) => <option key={r.id} value={r.title}>{r.title}</option>)}
          </select>
        ) : (
          <p className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted">
            No requirements allocated to you today.
          </p>
        )}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button disabled={saving} onClick={submit}>{saving ? "Saving..." : "Save"}</Button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </Card>
  );
}
