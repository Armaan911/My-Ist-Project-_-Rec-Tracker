"use client";

import { useState } from "react";
import { sendManagerMessage } from "@/app/manager/messages/actions";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";

type Recruiter = { id: string; full_name: string; divisions?: { name: string } | null };

export default function MessageComposer({ recruiters }: { recruiters: Recruiter[] }) {
  const [toAll, setToAll] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function send() {
    setSending(true); setMsg(null);
    const res = await sendManagerMessage({
      recipient_ids: toAll ? "all" : Array.from(selected),
      subject, body,
    });
    setSending(false);
    if (res.ok) { setMsg(`Sent to ${res.count} recruiter${res.count === 1 ? "" : "s"}.`); setBody(""); setSubject(""); }
    else setMsg("Error: " + res.error);
  }

  return (
    <Card title="Message recruiters" action={<span className="text-xs text-muted">In-app + email</span>}>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={toAll} onChange={() => setToAll(true)} /> Everyone
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={!toAll} onChange={() => setToAll(false)} /> Pick recruiters
        </label>
      </div>

      {!toAll && (
        <div className="mb-3 max-h-40 overflow-y-auto rounded-lg border border-line p-2">
          {recruiters.length === 0 && <p className="px-1 text-sm text-muted">No recruiters.</p>}
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {recruiters.map((r) => (
              <label key={r.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-canvas">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                <span className="truncate">{r.full_name}</span>
                {r.divisions?.name && <span className="ml-auto shrink-0 text-xs text-muted">{r.divisions.name}</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div><Label>Subject (optional)</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Priority push on Acme reqs" /></div>
        <div><Label>Message</Label><Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type your message to the team…" /></div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button disabled={sending || !body.trim()} onClick={send}>{sending ? "Sending…" : "Send message"}</Button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </Card>
  );
}
