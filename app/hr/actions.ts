"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { emailAccountManagerForIncentive, emailIncentiveOutcome, formatMoney, getHrEmail } from "@/lib/rewards";

type Me = { id: string; role: string; full_name?: string | null };

// Only HR and admins act on incentive decisions.
async function gate(): Promise<{ ok: true; me: Me; admin: ReturnType<typeof createAdminClient> } | { ok: false; error: string }> {
  const me = (await getProfile()) as Me | null;
  if (!me || (me.role !== "hr" && me.role !== "admin")) return { ok: false, error: "Not authorized" };
  return { ok: true, me, admin: createAdminClient() };
}

async function load(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data } = await admin.from("reward_requests")
    .select("id, status, recruiter_id, manager_id, candidate_name").eq("id", id).maybeSingle();
  return data as { id: string; status: string; recruiter_id: string; manager_id: string | null; candidate_name: string | null } | null;
}

function refresh() {
  for (const p of ["/hr", "/hr/history", "/hr/analytics", "/manager/rewards", "/admin/rewards", "/admin/teams/rewards"]) revalidatePath(p);
}

// HR approves: record amount + currency, email payroll, notify recruiter + manager.
export async function approveIncentive(id: string, input: { amount: number; currency: "INR" | "USD" }) {
  const g = await gate(); if (!g.ok) return g;
  const rw = await load(g.admin, id);
  if (!rw) return { ok: false, error: "Not found" };
  if (rw.status !== "manager_confirmed") return { ok: false, error: "This request isn't awaiting HR." };

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a valid amount." };
  if (input.currency !== "INR" && input.currency !== "USD") return { ok: false, error: "Pick a currency." };

  const { data: upd } = await g.admin.from("reward_requests").update({
    status: "hr_approved", hr_decision: "approved", hr_decided_at: new Date().toISOString(),
    hr_id: g.me.id, amount, currency: input.currency,
  }).eq("id", id).eq("status", "manager_confirmed").select("id");
  if (!upd?.length) return { ok: false, error: "This request has already been decided." };

  // Email the payroll / account-manager recipient to add it to salary.
  await emailAccountManagerForIncentive(id);

  const money = formatMoney(amount, input.currency);
  await notify({
    userIds: [rw.recruiter_id, rw.manager_id].filter(Boolean) as string[],
    type: "message", title: "Incentive approved 🎉",
    body: `Approved by ${g.me.full_name ?? "HR"} (HR): a ${money} incentive for ${rw.candidate_name ?? "the closure"}. Payroll has been notified to add it to the recruiter's salary.`,
    link: "/dashboard",
  });
  await emailIncentiveOutcome({
    recipientIds: [rw.recruiter_id, rw.manager_id],
    fromUserId: g.me.id, fromEmail: await getHrEmail(),
    subject: `Incentive approved — ${rw.candidate_name ?? "closure"}`,
    html: `<p>HR has <b>approved</b> a <b>${money}</b> incentive for ${rw.candidate_name ?? "the closure"}.</p>` +
      `<p>Payroll has been notified to add it to the recruiter's salary.</p>`,
  });
  await logAudit(g.me.id, "incentive.approve", "reward_requests", id, { amount, currency: input.currency });
  refresh();
  return { ok: true };
}

// HR denies: a comment is required; notify recruiter + manager with it.
export async function denyIncentive(id: string, input: { comment: string }) {
  const g = await gate(); if (!g.ok) return g;
  const rw = await load(g.admin, id);
  if (!rw) return { ok: false, error: "Not found" };
  if (rw.status !== "manager_confirmed") return { ok: false, error: "This request isn't awaiting HR." };

  const comment = (input.comment || "").trim();
  if (!comment) return { ok: false, error: "A comment is required when denying." };

  const { data: upd } = await g.admin.from("reward_requests").update({
    status: "hr_rejected", hr_decision: "rejected", hr_decided_at: new Date().toISOString(),
    hr_id: g.me.id, hr_comment: comment,
  }).eq("id", id).eq("status", "manager_confirmed").select("id");
  if (!upd?.length) return { ok: false, error: "This request has already been decided." };

  await notify({
    userIds: [rw.recruiter_id, rw.manager_id].filter(Boolean) as string[],
    type: "message", title: "Incentive request declined",
    body: `Declined by ${g.me.full_name ?? "HR"} (HR): the incentive for ${rw.candidate_name ?? "the closure"} — ${comment}`,
    link: "/dashboard",
  });
  await emailIncentiveOutcome({
    recipientIds: [rw.recruiter_id, rw.manager_id],
    fromUserId: g.me.id, fromEmail: await getHrEmail(),
    subject: `Incentive request declined — ${rw.candidate_name ?? "closure"}`,
    html: `<p>HR has <b>declined</b> the incentive for ${rw.candidate_name ?? "the closure"}.</p>` +
      `<p>Reason: ${comment}</p>`,
  });
  await logAudit(g.me.id, "incentive.deny", "reward_requests", id, { comment });
  refresh();
  return { ok: true };
}

// Mark an approved incentive as paid out (terminal). Closes the loop after payroll.
export async function markPaid(id: string) {
  const g = await gate(); if (!g.ok) return g;
  const rw = await load(g.admin, id);
  if (!rw) return { ok: false, error: "Not found" };
  if (rw.status !== "hr_approved") return { ok: false, error: "Only approved incentives can be marked paid." };

  const { data: upd } = await g.admin.from("reward_requests").update({
    status: "initiated", initiated_at: new Date().toISOString(), initiated_by: g.me.id,
  }).eq("id", id).eq("status", "hr_approved").select("id");
  if (!upd?.length) return { ok: false, error: "This request has already been processed." };

  await notify({
    userIds: [rw.recruiter_id], type: "message", title: "Incentive paid 🎉",
    body: `Your incentive for ${rw.candidate_name ?? "your closure"} has been processed.`,
    link: "/dashboard",
  });
  await logAudit(g.me.id, "incentive.paid", "reward_requests", id, null);
  refresh();
  return { ok: true };
}
