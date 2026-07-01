import { redirect } from "next/navigation";
import { lookupManagerApproval, decideManagerApproval } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// The mutation happens ONLY on this POST (a human clicking a button) — never on the GET render,
// so email link-scanners (Outlook Safe Links, iOS Mail preview, corporate proxies) can't
// auto-approve or auto-reject. After acting, redirect back with the outcome (a read-only GET).
async function submit(formData: FormData) {
  "use server";
  const token = String(formData.get("token") || "");
  const decision = formData.get("decision") === "reject" ? "reject" : "approve";
  const res = await decideManagerApproval(token, decision);
  const state =
    res.status === "approved" ? "approved" :
    res.status === "rejected" ? "rejected" :
    res.status === "already" ? "already" : "invalid";
  redirect(`/rewards/approve/${encodeURIComponent(token)}?state=${state}`);
}

function Shell({ tone, heading, body, children }: { tone: "ok" | "bad" | "neutral"; heading: string; body: string; children?: React.ReactNode }) {
  const color = tone === "ok" ? "#16a34a" : tone === "bad" ? "#dc2626" : "#475569";
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f6f7fb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 460, width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 28, boxShadow: "0 6px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ height: 6, width: 48, borderRadius: 999, background: color, marginBottom: 16 }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#111827" }}>{heading}</h1>
        <p style={{ marginTop: 10, color: "#4b5563", lineHeight: 1.5 }}>{body}</p>
        {children}
      </div>
    </main>
  );
}

export default async function ManagerApprovalPage({
  params, searchParams,
}: { params: { token: string }; searchParams: { d?: string; state?: string } }) {
  const token = params.token;

  // Post-decision outcome (read-only; no mutation on this render).
  if (searchParams.state) {
    const s = searchParams.state;
    if (s === "approved") return <Shell tone="ok" heading="Approved ✅" body="You approved the incentive. It's been sent to HR for the payout decision, and the recruiter has been notified." />;
    if (s === "rejected") return <Shell tone="bad" heading="Rejected" body="Recorded — you rejected the incentive request. The recruiter has been notified." />;
    if (s === "already") return <Shell tone="neutral" heading="Already handled" body="This incentive request has already been processed. No further action is needed." />;
    return <Shell tone="neutral" heading="Invalid or expired link" body="This approval link isn't valid anymore." />;
  }

  // GET: look up read-only and render confirm buttons (nothing is changed yet).
  const info = await lookupManagerApproval(token);
  const cand = info.candidate ?? "the incentive";
  if (info.status === "invalid") return <Shell tone="neutral" heading="Invalid or expired link" body="This approval link isn't valid anymore. It may have already been actioned." />;
  if (info.status === "already") return <Shell tone="neutral" heading="Already handled" body={`This incentive request for ${cand} has already been processed. No further action is needed.`} />;

  const btn = (bg: string): React.CSSProperties => ({ flex: 1, padding: "12px 18px", border: 0, borderRadius: 10, color: "#fff", background: bg, fontWeight: 700, fontSize: 15, cursor: "pointer" });
  return (
    <Shell tone="neutral" heading="Review incentive request" body={`Confirm your decision on the incentive for ${cand}. Nothing changes until you click a button below.`}>
      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <form action={submit} style={{ flex: 1, display: "flex" }}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="decision" value="approve" />
          <button type="submit" style={btn("#16a34a")}>✓ Approve</button>
        </form>
        <form action={submit} style={{ flex: 1, display: "flex" }}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="decision" value="reject" />
          <button type="submit" style={btn("#dc2626")}>✕ Reject</button>
        </form>
      </div>
    </Shell>
  );
}
