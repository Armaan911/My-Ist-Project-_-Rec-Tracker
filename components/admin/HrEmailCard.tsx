"use client";
import { useState } from "react";
import { Mail } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";
import { updateHrEmail } from "@/app/admin/config/actions";

// Admin-editable HR recipient for closure-reward emails.
export default function HrEmailCard({ initial }: { initial: string }) {
  const [email, setEmail] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true); setMsg(null);
    const res = await updateHrEmail(email);
    setSaving(false);
    setMsg(res.ok ? "Saved." : res.error ?? "Failed");
  }

  return (
    <Card title="HR email (closure rewards)">
      <p className="mb-3 text-sm text-muted">
        When a manager confirms a closure, an email with an approve/reject link is sent here to initiate the reward.
        Leave blank to disable HR emails (the closure still gets confirmed and tracked).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <Label><span className="inline-flex items-center gap-1.5"><Mail size={13} /> HR email address</span></Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hr@yourcompany.com" />
        </div>
        <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</Button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </Card>
  );
}
