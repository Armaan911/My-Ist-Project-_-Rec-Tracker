"use client";
import { useState } from "react";
import { approveChange, rejectChange } from "@/app/admin/approvals/actions";
import { Card } from "@/components/ui";

type CR = { id: string; entity_type: string; payload: any; reason: string | null; created_at: string; profiles?: { full_name: string } | null };

export default function ApprovalsList({ requests }: { requests: CR[] }) {
  const [done, setDone] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  async function act(id: string, kind: "approve" | "reject") {
    const res = kind === "approve" ? await approveChange(id) : await rejectChange(id);
    if (res.ok) setDone({ ...done, [id]: kind === "approve" ? "approved" : "rejected" });
    else setMsg("Error: " + res.error);
  }

  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold">Pending past-day edits</h2>
      {msg && <p className="mb-2 text-sm text-red-600">{msg}</p>}
      {requests.length === 0 ? (
        <p className="text-sm text-slate-400">No pending requests.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((c) => (
            <li key={c.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="text-sm">
                  <p className="font-medium">{c.profiles?.full_name ?? "Recruiter"} · {c.entity_type}</p>
                  {c.payload?.activity_date && <p className="text-slate-500">For {c.payload.activity_date}</p>}
                  {c.payload?.date && c.entity_type === "daily_activity_item" && <p className="text-slate-500">For {c.payload.date}</p>}
                  <p className="mt-1 text-slate-600">
                    {c.entity_type === "daily_activity"
                      ? `Resumes ${c.payload?.resumes_sourced ?? "—"}, parsed ${c.payload?.applicants_parsed ?? "—"}${c.payload?.notes ? ` · ${c.payload.notes}` : ""}`
                      : c.entity_type === "daily_activity_item"
                      ? `${(c.payload?.items?.length ?? 0)} requirement${(c.payload?.items?.length ?? 0) === 1 ? "" : "s"} · ${(c.payload?.items ?? []).reduce((n: number, i: any) => n + Object.values(i.values || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0), 0)} actions logged`
                      : JSON.stringify(c.payload)}
                  </p>
                  {c.reason && <p className="text-xs text-slate-400">Reason: {c.reason}</p>}
                </div>
                <div className="shrink-0 text-sm">
                  {done[c.id] ? (
                    <span className="text-slate-500">{done[c.id]}</span>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => act(c.id, "approve")} className="rounded-md bg-slate-900 px-3 py-1 text-white">Approve</button>
                      <button onClick={() => act(c.id, "reject")} className="rounded-md border border-slate-300 px-3 py-1">Reject</button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
