"use client";
import { useState } from "react";
import { Gift, Send } from "lucide-react";
import { Button, Input, Label, Modal, Textarea, Spinner } from "@/components/ui";
import { toast } from "@/components/uikit";
import { requestIncentive } from "@/app/dashboard/incentive-actions";

// Recruiter button: request an incentive, routed to manager(s) + admins for approval.
export default function RequestIncentiveButton() {
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!candidate.trim()) { toast("Candidate name is required", "error"); return; }
    if (!reason.trim()) { toast("Tell us what the incentive is for", "error"); return; }
    setSaving(true);
    const res = await requestIncentive({ candidate_name: candidate, reason });
    setSaving(false);
    if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
    toast("Request sent to your manager and admin", "success");
    setOpen(false); setCandidate(""); setReason("");
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Gift size={15} /> Request incentive
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Request an incentive"
        description="This goes to your manager and the admins to approve or reject. If approved, it moves to HR for the payout decision."
        footer={<>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={saving} onClick={submit}>{saving ? <><Spinner /> Sending…</> : <><Send size={15} /> Send request</>}</Button>
        </>}>
        <div className="space-y-4">
          <div>
            <Label>Candidate / closure</Label>
            <Input value={candidate} onChange={(e) => setCandidate(e.target.value)} placeholder="e.g. Rahul Verma — Java Developer" />
          </div>
          <div>
            <Label>What is this incentive for?</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              placeholder="Briefly explain the closure / achievement this incentive is for." />
          </div>
        </div>
      </Modal>
    </>
  );
}
