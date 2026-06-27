"use client";
import { useState } from "react";
import { Banknote } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";
import { updateAccountManagerEmail } from "@/app/admin/config/actions";

// Admin-editable payroll / account-manager recipient for approved-incentive emails.
export default function AccountManagerEmailCard({ initial }: { initial: string }) {
  const [email, setEmail] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true); setMsg(null);
    const res = await updateAccountManagerEmail(email);
    setSaving(false);
    setMsg(res.ok ? "Saved." : res.error ?? "Failed");
  }

  return (
    <Card title="Account manager email (incentive payouts)">
      <p className="mb-3 text-sm text-muted">
        When HR approves an incentive, an email is sent here asking to add the amount to the recruiter's salary.
        Leave blank to disable payroll emails (the approval still notifies the recruiter and manager in-app).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <Label><span className="inline-flex items-center gap-1.5"><Banknote size={13} /> Account manager / payroll email</span></Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="payroll@yourcompany.com" />
        </div>
        <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</Button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </Card>
  );
}
