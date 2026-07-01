import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { sha256 } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// Mutation happens ONLY on this POST (human click) — never on GET render — so email scanners
// can't auto-decide. Transition is atomic and the token is cleared so the link can't be replayed.
async function submit(formData: FormData) {
  "use server";
  const token = String(formData.get("token") || "");
  const decision = formData.get("decision") === "reject" ? "reject" : "approve";
  const admin = createAdminClient();
  const { data: rw } = await admin.from("reward_requests")
    .select("id, status, candidate_name, recruiter_id, manager_id")
    .eq("hr_token_hash", sha256(token)).maybeSingle();

  let state = "invalid";
  if (rw) {
    const r = rw as { id: string; status: string; candidate_name: string | null; recruiter_id: string; manager_id: string | null };
    const { data: upd } = await admin.from("reward_requests").update({
      status: decision === "approve" ? "hr_approved" : "hr_rejected",
      hr_decision: decision === "approve" ? "approved" : "rejected",
      hr_decided_at: new Date().toISOString(), hr_token_hash: null,
    }).eq("id", r.id).eq("status", "manager_confirmed").select("id");
    if (upd?.length) {
      const cand = r.candidate_name ?? "the candidate";
      await notify({
        userIds: [r.recruiter_id, ...(r.manager_id ? [r.manager_id] : [])],
        type: "message",
        title: decision === "approve" ? "HR approved the reward" : "HR rejected the reward",
        body: decision === "approve" ? `HR approved the reward for ${cand}. It can now be initiated.` : `HR rejected the reward for ${cand}.`,
        link: "/manager/rewards",
      });
      state = decision === "approve" ? "approved" : "rejected";
    } else {
      state = "already";
    }
  }
  redirect(`/rewards/hr/${encodeURIComponent(token)}?state=${state}`);
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

export default async function HrRewardDecisionPage({
  params, searchParams,
}: { params: { token: string }; searchParams: { d?: string; state?: string } }) {
  const token = params.token;

  if (searchParams.state) {
    const s = searchParams.state;
    if (s === "approved") return <Shell tone="ok" heading="Reward approved ✅" body="The reward is approved. The team can now initiate it." />;
    if (s === "rejected") return <Shell tone="bad" heading="Reward rejected" body="Recorded — the reward was rejected." />;
    if (s === "already") return <Shell tone="neutral" heading="Already recorded" body="This reward has already been decided. No further action is needed." />;
    return <Shell tone="neutral" heading="Invalid or expired link" body="This reward link isn't valid anymore." />;
  }

  const admin = createAdminClient();
  const { data: rw } = await admin.from("reward_requests")
    .select("status, candidate_name").eq("hr_token_hash", sha256(token)).maybeSingle();
  if (!rw) return <Shell tone="neutral" heading="Invalid or expired link" body="This reward link isn't valid anymore. It may have already been actioned." />;
  const r = rw as { status: string; candidate_name: string | null };
  const cand = r.candidate_name ?? "the candidate";
  if (r.status !== "manager_confirmed") return <Shell tone="neutral" heading="Already recorded" body={`This reward for ${cand} is already "${r.status.replace(/_/g, " ")}". No further action needed.`} />;

  const btn = (bg: string): React.CSSProperties => ({ flex: 1, padding: "12px 18px", border: 0, borderRadius: 10, color: "#fff", background: bg, fontWeight: 700, fontSize: 15, cursor: "pointer" });
  return (
    <Shell tone="neutral" heading="Reward decision" body={`Confirm your decision on the reward for ${cand}. Nothing changes until you click a button below.`}>
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
