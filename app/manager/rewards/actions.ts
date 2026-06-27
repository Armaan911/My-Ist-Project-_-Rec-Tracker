"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { emailHrForReward, emailIncentiveOutcome } from "@/lib/rewards";

type Me = { id: string; role: string; division_id: string | null; full_name?: string | null };
const path = "/manager/rewards";

// Admins act on any reward; managers only on their division's.
async function gate(rewardDivisionId: string | null):
  Promise<{ ok: true; me: Me; admin: ReturnType<typeof createAdminClient> } | { ok: false; error: string }> {
  const me = (await getProfile()) as Me | null;
  if (!me || (me.role !== "admin" && me.role !== "manager")) return { ok: false, error: "Not authorized" };
  const admin = createAdminClient();
  if (me.role === "manager") {
    const { data: pd } = await admin.from("profile_divisions").select("division_id").eq("profile_id", me.id);
    const myDivs = new Set<string>(((pd ?? []) as { division_id: string }[]).map((r) => r.division_id));
    if (me.division_id) myDivs.add(me.division_id);
    if (!rewardDivisionId || !myDivs.has(rewardDivisionId)) return { ok: false, error: "This reward is outside your division." };
  }
  return { ok: true, me, admin };
}

async function load(id: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("reward_requests")
    .select("id, status, division_id, recruiter_id, candidate_name").eq("id", id).maybeSingle();
  return data as { id: string; status: string; division_id: string | null; recruiter_id: string; candidate_name: string | null } | null;
}

export async function confirmReward(id: string, opts?: { amount?: number | null; currency?: "INR" | "USD" | null }) {
  const rw = await load(id);
  if (!rw) return { ok: false, error: "Not found" };
  if (rw.status !== "pending_manager") return { ok: false, error: "Already processed" };
  const g = await gate(rw.division_id); if (!g.ok) return g;

  // Manager may propose an amount + currency; HR sees it pre-filled and can adjust.
  const patch: Record<string, unknown> = { status: "manager_confirmed", manager_id: g.me.id, manager_confirmed_at: new Date().toISOString() };
  const amt = opts?.amount == null ? null : Number(opts.amount);
  if (amt != null && Number.isFinite(amt) && amt > 0) {
    patch.amount = amt;
    patch.currency = opts?.currency === "USD" ? "USD" : "INR";
  }
  await g.admin.from("reward_requests").update(patch).eq("id", id);

  await emailHrForReward(id, g.me.id);
  const who = `${g.me.full_name ?? "your reviewer"} (${g.me.role === "admin" ? "admin" : "manager"})`;
  await notify({ userIds: [rw.recruiter_id], type: "message", title: "Incentive approved — awaiting HR",
    body: `Your incentive for ${rw.candidate_name ?? "your candidate"} was approved by ${who} and is now waiting for HR approval.`, link: "/dashboard" });
  await emailIncentiveOutcome({ recipientIds: [rw.recruiter_id], fromUserId: g.me.id,
    subject: `Incentive approved by ${g.me.full_name ?? "your reviewer"} — awaiting HR`,
    html: `<p>Your incentive${rw.candidate_name ? ` for ${rw.candidate_name}` : ""} was <b>approved</b> by ${who} and is now awaiting HR approval.</p>` });
  await logAudit(g.me.id, "reward.confirm", "reward_requests", id, null);
  revalidatePath(path);
  return { ok: true };
}

export async function rejectReward(id: string, reason?: string) {
  const rw = await load(id);
  if (!rw) return { ok: false, error: "Not found" };
  if (rw.status === "initiated") return { ok: false, error: "Already initiated" };
  const g = await gate(rw.division_id); if (!g.ok) return g;
  await g.admin.from("reward_requests").update({ status: "rejected", manager_id: g.me.id, note: reason ?? null }).eq("id", id);
  await notify({ userIds: [rw.recruiter_id], type: "message", title: "Incentive rejected",
    body: `Your incentive for ${rw.candidate_name ?? "your candidate"} was rejected${reason ? `: ${reason}` : ""}.`, link: "/dashboard" });
  await emailIncentiveOutcome({ recipientIds: [rw.recruiter_id], fromUserId: g.me.id,
    subject: "Incentive rejected",
    html: `<p>Your incentive${rw.candidate_name ? ` for ${rw.candidate_name}` : ""} was <b>rejected</b>${reason ? `: ${reason}` : ""}.</p>` });
  await logAudit(g.me.id, "reward.reject", "reward_requests", id, { reason });
  revalidatePath(path);
  return { ok: true };
}

export async function markInitiated(id: string, note?: string) {
  const rw = await load(id);
  if (!rw) return { ok: false, error: "Not found" };
  if (rw.status !== "hr_approved") return { ok: false, error: "HR hasn't approved this yet." };
  const g = await gate(rw.division_id); if (!g.ok) return g;
  await g.admin.from("reward_requests")
    .update({ status: "initiated", initiated_at: new Date().toISOString(), initiated_by: g.me.id, note: note ?? null }).eq("id", id);
  await notify({ userIds: [rw.recruiter_id], type: "message", title: "Reward initiated 🎉",
    body: `Your reward for ${rw.candidate_name ?? "your candidate"} has been initiated.`, link: "/dashboard" });
  await logAudit(g.me.id, "reward.initiated", "reward_requests", id, null);
  revalidatePath(path);
  return { ok: true };
}

// Re-send the HR email (e.g. after the HR address was filled in on Configuration).
export async function resendHrEmail(id: string) {
  const rw = await load(id);
  if (!rw) return { ok: false, error: "Not found" };
  if (rw.status !== "manager_confirmed") return { ok: false, error: "Confirm the closure first." };
  const g = await gate(rw.division_id); if (!g.ok) return g;
  await emailHrForReward(id, g.me.id);
  revalidatePath(path);
  return { ok: true };
}
