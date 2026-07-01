"use client";
import { useState } from "react";
import { Card } from "@/components/ui";

// Reference workflows, bucketed by desk. Only the selected bucket renders.
// NOTE: the step content below is a PLACEHOLDER template — replace each bucket's steps with
// your real US IT / India IT / Internal SOP (edit here, or ask to make these DB-editable).
type Step = { title: string; detail: string };
const BUCKETS: { key: string; label: string; steps: Step[] }[] = [
  {
    key: "us_it", label: "US IT",
    steps: [
      { title: "Requirement intake", detail: "Confirm job title, client/vendor, rate, location, work authorization, and job code before sourcing." },
      { title: "Sourcing", detail: "Source candidates (LinkedIn, portals, referrals); capture LinkedIn URL, location, phone, email." },
      { title: "Screening", detail: "Verify work authorization/visa, rate expectation, availability and relocation." },
      { title: "Submit in RR", detail: "Record the submission in the tracker with the candidate's LinkedIn URL (used to de-duplicate)." },
      { title: "Submit to client", detail: "Format and submit to the client/vendor; move the submission to “Submitted to Client”." },
      { title: "Interview → Offer → Onboard", detail: "Track interview, closure and onboarding; a closure triggers the incentive approval flow." },
    ],
  },
  {
    key: "india_it", label: "India IT",
    steps: [
      { title: "Requirement intake", detail: "Confirm role, client, CTC band, location, and notice-period expectation." },
      { title: "Sourcing", detail: "Source candidates; capture LinkedIn URL, current company/CTC, expected CTC, notice period." },
      { title: "Screening", detail: "Validate notice period, offer-in-hand status, and CTC fitment." },
      { title: "Submit in RR", detail: "Record the submission with LinkedIn URL for de-duplication across recruiters." },
      { title: "Submit to client", detail: "Submit to the client; keep the pipeline status current." },
      { title: "Interview → Offer → Onboard", detail: "Track through closure and onboarding; closures start the incentive workflow." },
    ],
  },
  {
    key: "internal", label: "Internal",
    steps: [
      { title: "Requirement intake", detail: "Confirm the internal role, hiring manager, and headcount approval." },
      { title: "Sourcing & referrals", detail: "Prioritise internal referrals and the internal database; capture candidate details." },
      { title: "Screening", detail: "Screen for role fit and internal policy alignment." },
      { title: "Submit in RR", detail: "Record the submission with LinkedIn URL for de-duplication." },
      { title: "Interview loop", detail: "Coordinate the internal interview panel and feedback." },
      { title: "Offer → Onboard", detail: "Track the offer and onboarding to closure." },
    ],
  },
];

export default function ReferenceGuide() {
  const [key, setKey] = useState(BUCKETS[0].key);
  const bucket = BUCKETS.find((b) => b.key === key) ?? BUCKETS[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reference</h1>
          <p className="text-sm text-muted">Recruitment workflow reference. Pick a desk to see only its steps.</p>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-muted">Reference Type</label>
          <select value={key} onChange={(e) => setKey(e.target.value)} className="mt-1 h-10 min-w-[200px] rounded-lg border border-line bg-surface px-3 text-sm">
            {BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
          </select>
        </div>
      </div>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">{bucket.label} workflow</h2>
        <ol className="space-y-3">
          {bucket.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
              <div>
                <div className="text-sm font-semibold text-ink">{s.title}</div>
                <div className="text-sm text-muted">{s.detail}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
