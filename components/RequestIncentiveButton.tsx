"use client";
import { useState } from "react";
import { Gift, Send } from "lucide-react";
import { Button, Input, Label, Modal, Textarea, Spinner } from "@/components/ui";
import { toast } from "@/components/uikit";
import { requestIncentive } from "@/app/dashboard/incentive-actions";

const empty = { candidate_name: "", job_title: "", client_name: "", vendor_name: "", rate_closed: "", other_details: "" };

// Recruiter button: request an incentive, routed to manager(s) + admins for approval.
export default function RequestIncentiveButton() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof empty, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!f.candidate_name.trim()) { toast("Candidate name is required", "error"); return; }
    if (!f.job_title.trim()) { toast("Job title is required", "error"); return; }
    if (!f.client_name.trim()) { toast("Client name is required", "error"); return; }
    if (!f.rate_closed.trim()) { toast("Rate closed at is required", "error"); return; }
    setSaving(true);
    const res = await requestIncentive(f);
    setSaving(false);
    if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
    toast("Request sent to your manager and admin", "success");
    setOpen(false); setF({ ...empty });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Gift size={15} /> Request incentive
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} wide title="Request an incentive"
        description="This goes to your manager and the admins to approve or reject. If approved, it moves to HR for the payout decision."
        footer={<>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={saving} onClick={submit}>{saving ? <><Spinner /> Sending…</> : <><Send size={15} /> Send request</>}</Button>
        </>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Label>Candidate name <span className="text-danger-600">*</span></Label><Input value={f.candidate_name} onChange={(e) => set("candidate_name", e.target.value)} placeholder="e.g. Rahul Verma" /></div>
          <div><Label>Job title <span className="text-danger-600">*</span></Label><Input value={f.job_title} onChange={(e) => set("job_title", e.target.value)} placeholder="e.g. Java Developer" /></div>
          <div><Label>Client name <span className="text-danger-600">*</span></Label><Input value={f.client_name} onChange={(e) => set("client_name", e.target.value)} placeholder="e.g. Acme Corp" /></div>
          <div><Label>Vendor name <span className="text-muted">(optional)</span></Label><Input value={f.vendor_name} onChange={(e) => set("vendor_name", e.target.value)} /></div>
          <div><Label>Rate closed at <span className="text-danger-600">*</span></Label><Input value={f.rate_closed} onChange={(e) => set("rate_closed", e.target.value)} placeholder="e.g. ₹18,00,000 / yr" /></div>
          <div className="sm:col-span-2"><Label>Other details <span className="text-muted">(optional)</span></Label><Textarea value={f.other_details} onChange={(e) => set("other_details", e.target.value)} rows={2} placeholder="Anything else the approver should know." /></div>
        </div>
      </Modal>
    </>
  );
}
