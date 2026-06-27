import { decideManagerApproval } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// Manager/admin clicks an Approve/Reject link from the incentive-request email (no login).
// Tokenized + idempotent. On approve the request moves to HR.
export default async function ManagerApprovalPage({
  params, searchParams,
}: { params: { token: string }; searchParams: { d?: string } }) {
  const decision = searchParams.d === "reject" ? "reject" : searchParams.d === "approve" ? "approve" : null;
  const res = await decideManagerApproval(params.token, decision);

  let heading = "Invalid or expired link";
  let body = "This approval link isn't valid anymore. It may have already been actioned.";
  let tone: "ok" | "bad" | "neutral" = "neutral";

  const cand = res.candidate ?? "the incentive";
  if (res.status === "approved") {
    heading = "Approved ✅";
    body = `Thanks, ${res.approverName}! You approved the incentive for ${cand}. It has been sent to HR for the payout decision, and the recruiter has been notified.`;
    tone = "ok";
  } else if (res.status === "rejected") {
    heading = "Rejected";
    body = `Recorded — you rejected the incentive request for ${cand}. The recruiter has been notified.`;
    tone = "bad";
  } else if (res.status === "already") {
    heading = "Already handled";
    body = `This incentive request for ${cand} has already been actioned. No further action is needed.`;
  } else if (res.status === "error") {
    heading = "Choose an action";
    body = "Use the Approve or Reject link from the email.";
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
