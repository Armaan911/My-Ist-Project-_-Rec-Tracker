import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { sha256 } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// HR clicks an Approve/Reject link from the email (no login). Tokenized + idempotent.
export default async function HrRewardDecisionPage({
  params, searchParams,
}: { params: { token: string }; searchParams: { d?: string } }) {
  const decision = searchParams.d === "reject" ? "reject" : searchParams.d === "approve" ? "approve" : null;
  const admin = createAdminClient();

  const { data: rw } = await admin
    .from("reward_requests")
    .select("id, status, candidate_name, requirement_title, recruiter_id, manager_id, hr_decided_at")
    .eq("hr_token_hash", sha256(params.token))
    .maybeSingle();

  let heading = "Invalid or expired link";
  let body = "This reward link isn't valid anymore. It may have already been actioned.";
  let tone: "ok" | "bad" | "neutral" = "neutral";

  if (rw) {
    const r = rw as {
      id: string; status: string; candidate_name: string | null; requirement_title: string | null;
      recruiter_id: string; manager_id: string | null; hr_decided_at: string | null;
    };
    const cand = r.candidate_name ?? "the candidate";

    if (r.hr_decided_at || r.status === "hr_approved" || r.status === "hr_rejected" || r.status === "initiated") {
      heading = "Already recorded";
      body = `This reward for ${cand} is already marked "${r.status.replace(/_/g, " ")}". No further action needed.`;
      tone = "neutral";
    } else if (r.status !== "manager_confirmed") {
      heading = "Not ready";
      body = `This reward isn't awaiting HR yet (current status: ${r.status.replace(/_/g, " ")}).`;
    } else if (!decision) {
      heading = "Choose an action";
      body = "Use the Approve or Reject link from the email.";
    } else if (decision === "approve") {
      await admin.from("reward_requests").update({ status: "hr_approved", hr_decision: "approved", hr_decided_at: new Date().toISOString() }).eq("id", r.id);
      await notify({
        userIds: [r.recruiter_id, ...(r.manager_id ? [r.manager_id] : [])],
        type: "message", title: "HR approved the reward",
        body: `HR approved the reward for ${cand}. It can now be initiated.`, link: "/manager/rewards",
      });
      heading = "Reward approved ✅";
      body = `Thanks! The reward for ${cand} is approved. The team will initiate it.`;
      tone = "ok";
    } else {
      await admin.from("reward_requests").update({ status: "hr_rejected", hr_decision: "rejected", hr_decided_at: new Date().toISOString() }).eq("id", r.id);
      await notify({
        userIds: [r.recruiter_id, ...(r.manager_id ? [r.manager_id] : [])],
        type: "message", title: "HR rejected the reward",
        body: `HR rejected the reward for ${cand}.`, link: "/manager/rewards",
      });
      heading = "Reward rejected";
      body = `Recorded — the reward for ${cand} was rejected.`;
      tone = "bad";
    }
  }

  const color = tone === "ok" ? "#16a34a" : tone === "bad" ? "#dc2626" : "#475569";
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f6f7fb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 460, width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 28, boxShadow: "0 6px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ height: 6, width: 48, borderRadius: 999, background: color, marginBottom: 16 }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#111827" }}>{heading}</h1>
        <p style={{ marginTop: 10, color: "#4b5563", lineHeight: 1.5 }}>{body}</p>
      </div>
    </main>
  );
}
