// Server-only: closure reward workflow helpers. Uses the service-role client.
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, approvalReviewers } from "@/lib/notify";
import { sendEmail } from "@/lib/email";

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

// A styled, client-compatible button for HTML emails (inline styles only).
function emailButton(href: string, bg: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 26px;margin:6px 10px 6px 0;background:${bg};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">${label}</a>`;
}

export async function getHrEmail(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("app_settings").select("value").eq("key", "hr_email").maybeSingle();
    const email = (data?.value as { email?: string } | null)?.email?.trim();
    return email || null;
  } catch {
    return null;
  }
}

// Payroll / "account manager" recipient for approved-incentive emails.
export async function getAccountManagerEmail(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("app_settings").select("value").eq("key", "account_manager_email").maybeSingle();
    const email = (data?.value as { email?: string } | null)?.email?.trim();
    return email || null;
  } catch {
    return null;
  }
}

// Active HR-role users who staff the incentive "My Plate".
async function hrRecipients(): Promise<{ id: string; email: string | null }[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, email").eq("role", "hr").eq("is_active", true);
  return (data ?? []) as { id: string; email: string | null }[];
}

// Human-friendly money string, e.g. ₹25,000 or $1,200.
export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  const sym = currency === "USD" ? "$" : currency === "INR" ? "₹" : "";
  const locale = currency === "USD" ? "en-US" : "en-IN";
  const n = Number(amount).toLocaleString(locale, { maximumFractionDigits: 2 });
  return `${sym}${n}${currency && !sym ? ` ${currency}` : ""}`;
}

// Admins (all) + managers of the division — the people who can confirm a reward.
async function rewardReviewerIds(divisionId: string | null): Promise<string[]> {
  const admin = createAdminClient();
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin").eq("is_active", true);
  let managerIds: string[] = [];
  if (divisionId) {
    const { data: pd } = await admin.from("profile_divisions").select("profile_id").eq("division_id", divisionId);
    const ids = ((pd ?? []) as { profile_id: string }[]).map((r) => r.profile_id);
    if (ids.length) {
      const { data: mgr } = await admin.from("profiles").select("id").eq("role", "manager").eq("is_active", true).in("id", ids);
      managerIds = ((mgr ?? []) as { id: string }[]).map((m) => m.id);
    }
  } else {
    const { data: mgr } = await admin.from("profiles").select("id").eq("role", "manager").eq("is_active", true);
    managerIds = ((mgr ?? []) as { id: string }[]).map((m) => m.id);
  }
  return Array.from(new Set([...((admins ?? []) as { id: string }[]).map((a) => a.id), ...managerIds]));
}

// Called when a recruiter records a closure. Creates one reward request per closed
// submission and notifies the division's managers + admins to confirm. Best-effort.
export async function createRewardOnClosure(submissionId: string, recruiterId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: existing } = await admin.from("reward_requests").select("id").eq("submission_id", submissionId).maybeSingle();
    if (existing) return; // already tracked

    const { data: sub } = await admin
      .from("submissions").select("candidate_name, division_id, requirements(title)").eq("id", submissionId).maybeSingle();
    const candidate = (sub as { candidate_name?: string } | null)?.candidate_name ?? "a candidate";
    const divisionId = (sub as { division_id?: string | null } | null)?.division_id ?? null;
    const reqTitle = (sub as { requirements?: { title?: string } | null } | null)?.requirements?.title ?? null;

    const { data: inserted, error } = await admin.from("reward_requests").insert({
      submission_id: submissionId, recruiter_id: recruiterId, division_id: divisionId,
      candidate_name: candidate, requirement_title: reqTitle, status: "pending_manager",
    }).select("id").single();
    if (error || !inserted) { console.log("[rewards] create failed:", error?.message); return; }

    const { data: rec } = await admin.from("profiles").select("full_name").eq("id", recruiterId).maybeSingle();
    const recruiterName = (rec as { full_name?: string } | null)?.full_name ?? "A recruiter";

    const reviewerIds = await rewardReviewerIds(divisionId);
    if (reviewerIds.length) {
      await notify({
        userIds: reviewerIds,
        type: "message",
        title: "Closure to confirm",
        body: `${recruiterName} recorded a closure for ${candidate}${reqTitle ? ` · ${reqTitle}` : ""}. Confirm it to start the reward.`,
        link: "/manager/rewards",
        metadata: { rewardId: inserted.id },
      });
    }
  } catch (e) {
    console.log("[rewards] createRewardOnClosure failed:", e);
  }
}

// Manager confirmed a reward: put it on HR's "My Plate". Notify every active HR
// user in-app and email them (plus the configured HR inbox) a link to the
// dashboard, where they set the amount + currency and approve or deny.
// (Kept the name `emailHrForReward` so existing callers don't change.)
export async function emailHrForReward(rewardId: string, managerId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: rw } = await admin.from("reward_requests").select("candidate_name, requirement_title").eq("id", rewardId).maybeSingle();
    const { data: mgr } = await admin.from("profiles").select("full_name, email").eq("id", managerId).maybeSingle();
    const managerName = (mgr as { full_name?: string } | null)?.full_name ?? "A manager";
    const managerEmail = (mgr as { email?: string } | null)?.email ?? null;
    const candidate = (rw as { candidate_name?: string } | null)?.candidate_name ?? "a candidate";
    const reqTitle = (rw as { requirement_title?: string } | null)?.requirement_title ?? "—";

    const hr = await hrRecipients();
    const hrEmail = await getHrEmail();
    // Remember which inbox this was routed to (shown in the rewards tracker).
    await admin.from("reward_requests").update({ hr_email: hrEmail }).eq("id", rewardId);

    // In-app ping to every HR user.
    if (hr.length) {
      await notify({
        userIds: hr.map((h) => h.id),
        type: "message",
        title: "Incentive request on your plate",
        body: `${managerName} confirmed a closure for ${candidate}${reqTitle && reqTitle !== "—" ? ` · ${reqTitle}` : ""}. Set the amount and approve or deny.`,
        link: "/hr",
        metadata: { rewardId },
      });
    }

    // Email HR users + the configured HR inbox a link to the dashboard.
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const emails = Array.from(new Set([
      ...(hr.map((h) => h.email).filter(Boolean) as string[]),
      ...(hrEmail ? [hrEmail] : []),
    ]));
    if (!emails.length) { console.log("[rewards] no HR recipients for", rewardId); return; }

    const subject = `Incentive to review — ${candidate}`;
    const html =
      `<p>${managerName} has <b>confirmed a closure</b> and an incentive needs your review.</p>` +
      `<ul><li>Candidate: <b>${candidate}</b></li><li>Requirement: ${reqTitle}</li></ul>` +
      `<p>${emailButton(`${base}/hr`, "#068AD3", "Open the HR dashboard")}</p>` +
      `<p style="color:#555;font-size:13px">Set the amount, then approve or deny.</p>` +
      `<p style="color:#888;font-size:12px">Sign in with your HR account. Reply to reach ${managerName}.</p>`;
    await sendEmail(emails, subject, html, { replyTo: managerEmail, from: managerEmail });
  } catch (e) {
    console.log("[rewards] emailHrForReward failed:", e);
  }
}

// HR approved an incentive: email the payroll / "account manager" recipient to add
// the amount to the recruiter's salary. Records when the email went out. Best-effort.
export async function emailAccountManagerForIncentive(rewardId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: rw } = await admin.from("reward_requests")
      .select("recruiter_id, candidate_name, requirement_title, amount, currency, hr_id")
      .eq("id", rewardId).maybeSingle();
    if (!rw) return;
    const r = rw as { recruiter_id: string; candidate_name: string | null; requirement_title: string | null; amount: number | null; currency: string | null; hr_id: string | null };

    const { data: rec } = await admin.from("profiles").select("full_name, email").eq("id", r.recruiter_id).maybeSingle();
    const recruiterName = (rec as { full_name?: string } | null)?.full_name ?? "the recruiter";
    const recruiterEmail = (rec as { email?: string } | null)?.email ?? null;

    const amountStr = formatMoney(r.amount, r.currency);
    const candidate = r.candidate_name ?? "a candidate";
    const reqTitle = r.requirement_title ?? "—";

    const to = await getAccountManagerEmail();
    await admin.from("reward_requests").update({ payroll_emailed_at: new Date().toISOString() }).eq("id", rewardId);
    if (!to) { console.log("[rewards] no account-manager email configured for", rewardId); return; }

    // Send from the configured HR mailbox (falls back to the deciding HR user's address).
    let replyTo: string | null = await getHrEmail();
    if (!replyTo && r.hr_id) {
      const { data: hr } = await admin.from("profiles").select("email").eq("id", r.hr_id).maybeSingle();
      replyTo = (hr as { email?: string } | null)?.email ?? null;
    }

    const subject = `Add incentive to payroll — ${recruiterName} (${amountStr})`;
    const html =
      `<p>An incentive has been <b>approved by HR</b>. Please add it to the recruiter's salary.</p>` +
      `<ul>` +
      `<li>Recruiter: <b>${recruiterName}</b>${recruiterEmail ? ` (${recruiterEmail})` : ""}</li>` +
      `<li>Incentive amount: <b>${amountStr}</b></li>` +
      `<li>For closing: ${reqTitle}</li>` +
      `<li>Candidate: ${candidate}</li>` +
      `</ul>` +
      `<p style="color:#888;font-size:12px">Sent automatically when HR approved the incentive.</p>`;
    await sendEmail(to, subject, html, { replyTo, from: replyTo });
  } catch (e) {
    console.log("[rewards] emailAccountManagerForIncentive failed:", e);
  }
}

// Email an incentive outcome (approved/rejected) to the given profile ids, sent FROM the
// acting person's mailbox (HR or manager). Best-effort; never throws into the caller.
export async function emailIncentiveOutcome(opts: {
  recipientIds: (string | null | undefined)[];
  fromUserId?: string;        // actor; used only if fromEmail isn't given
  fromEmail?: string | null;  // explicit sender override (e.g. the configured HR mailbox)
  subject: string;
  html: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const ids = Array.from(new Set(opts.recipientIds.filter(Boolean) as string[]));
    if (ids.length === 0) return;
    const { data: recips } = await admin.from("profiles").select("email").in("id", ids);
    const emails = ((recips ?? []) as { email: string | null }[]).map((r) => r.email).filter(Boolean) as string[];
    if (emails.length === 0) return;
    let fromEmail = opts.fromEmail ?? null;
    if (!fromEmail && opts.fromUserId) {
      const { data: from } = await admin.from("profiles").select("email").eq("id", opts.fromUserId).maybeSingle();
      fromEmail = (from as { email?: string } | null)?.email ?? null;
    }
    await sendEmail(emails, opts.subject, opts.html, { from: fromEmail, replyTo: fromEmail });
  } catch (e) {
    console.log("[rewards] emailIncentiveOutcome failed:", e);
  }
}

// Recruiter requested an incentive: mint a unique no-login approve/reject link for each
// manager + admin reviewer and email it FROM the recruiter, plus an in-app ping. Best-effort.
export async function sendManagerApprovalRequest(rewardId: string, opts: {
  divisionId: string | null;
  recruiterName: string;
  recruiterEmail: string | null;
  candidate: string | null;
  reason: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const reviewers = await approvalReviewers(opts.divisionId); // active admins + division managers
    if (reviewers.length === 0) { console.log("[rewards] no reviewers for incentive request", rewardId); return; }

    await notify({
      userIds: reviewers.map((r) => r.id),
      type: "message",
      title: "Incentive approval requested",
      body: `${opts.recruiterName} requested an incentive${opts.candidate ? ` for ${opts.candidate}` : ""}${opts.reason ? ` — ${opts.reason}` : ""}. Approve or reject.`,
      link: "/manager/rewards",
      metadata: { rewardId },
    });

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    for (const rv of reviewers) {
      const rawToken = crypto.randomBytes(24).toString("hex");
      await admin.from("reward_approval_tokens").insert({ reward_id: rewardId, approver_id: rv.id, token_hash: sha256(rawToken) });
      if (!rv.email) continue;
      const approve = `${base}/rewards/approve/${rawToken}?d=approve`;
      const reject = `${base}/rewards/approve/${rawToken}?d=reject`;
      const subject = `Incentive approval requested — ${opts.recruiterName}`;
      const html =
        `<p><b>${opts.recruiterName}</b> has requested an incentive and needs your approval.</p>` +
        `<ul>${opts.candidate ? `<li>Candidate: <b>${opts.candidate}</b></li>` : ""}${opts.reason ? `<li>Details: ${opts.reason}</li>` : ""}</ul>` +
        `<p>${emailButton(approve, "#16a34a", "✓ Approve")}${emailButton(reject, "#dc2626", "✕ Reject")}</p>` +
        `<p style="color:#888;font-size:12px">No login needed — this link is unique to you. On approval it goes to HR for the payout decision.</p>`;
      // Sent FROM the requesting recruiter's mailbox (falls back to the default if unsendable).
      await sendEmail(rv.email, subject, html, { from: opts.recruiterEmail, replyTo: opts.recruiterEmail });
    }
  } catch (e) {
    console.log("[rewards] sendManagerApprovalRequest failed:", e);
  }
}

export type ManagerDecisionResult =
  { status: "approved" | "rejected"; candidate: string | null; approverName: string; approverRole: string }
  | { status: "invalid" | "already" | "error"; candidate?: string | null };

// A manager/admin clicked their one-click email link. Idempotent + attributes the approver.
// On approve -> manager_confirmed and forward to HR (emailed FROM the approver). On reject -> rejected.
// Either way the requesting recruiter is notified.
export async function decideManagerApproval(rawToken: string, decision: "approve" | "reject" | null): Promise<ManagerDecisionResult> {
  try {
    const admin = createAdminClient();
    const { data: tok } = await admin.from("reward_approval_tokens")
      .select("reward_id, approver_id").eq("token_hash", sha256(rawToken)).maybeSingle();
    if (!tok) return { status: "invalid" };
    const t = tok as { reward_id: string; approver_id: string | null };

    const { data: rw } = await admin.from("reward_requests")
      .select("id, status, recruiter_id, candidate_name").eq("id", t.reward_id).maybeSingle();
    if (!rw) return { status: "invalid" };
    const r = rw as { id: string; status: string; recruiter_id: string; candidate_name: string | null };
    if (r.status !== "pending_manager") return { status: "already", candidate: r.candidate_name };
    if (!decision) return { status: "error", candidate: r.candidate_name };

    const { data: ap } = await admin.from("profiles").select("full_name, role").eq("id", t.approver_id).maybeSingle();
    const approverName = (ap as { full_name?: string } | null)?.full_name ?? "A reviewer";
    const approverRole = (ap as { role?: string } | null)?.role === "admin" ? "admin" : "manager";
    const cand = r.candidate_name ?? "your incentive";

    if (decision === "approve") {
      await admin.from("reward_requests").update({
        status: "manager_confirmed", manager_id: t.approver_id, manager_confirmed_at: new Date().toISOString(),
      }).eq("id", r.id);
      await admin.from("reward_approval_tokens").delete().eq("reward_id", r.id); // consume all links for this request
      await notify({
        userIds: [r.recruiter_id], type: "message", title: "Incentive approved — awaiting HR",
        body: `Your incentive request${r.candidate_name ? ` for ${r.candidate_name}` : ""} was approved by ${approverName} (${approverRole}) and is now waiting for HR approval.`,
        link: "/dashboard",
      });
      if (t.approver_id) {
        await emailIncentiveOutcome({
          recipientIds: [r.recruiter_id], fromUserId: t.approver_id,
          subject: `Incentive approved by ${approverName} — awaiting HR`,
          html: `<p>Your incentive request${r.candidate_name ? ` for ${r.candidate_name}` : ""} was <b>approved</b> by ${approverName} (${approverRole}) and is now awaiting HR approval.</p>`,
        });
        await emailHrForReward(r.id, t.approver_id); // forward to HR, emailed from the approver
      }
      return { status: "approved", candidate: r.candidate_name, approverName, approverRole };
    }

    await admin.from("reward_requests").update({
      status: "rejected", manager_id: t.approver_id, note: `Rejected by ${approverName}`,
    }).eq("id", r.id);
    await admin.from("reward_approval_tokens").delete().eq("reward_id", r.id);
    await notify({
      userIds: [r.recruiter_id], type: "message", title: "Incentive request rejected",
      body: `Your incentive request${r.candidate_name ? ` for ${r.candidate_name}` : ""} was rejected by ${approverName} (${approverRole}).`,
      link: "/dashboard",
    });
    if (t.approver_id) await emailIncentiveOutcome({
      recipientIds: [r.recruiter_id], fromUserId: t.approver_id,
      subject: "Incentive request rejected",
      html: `<p>Your incentive request${r.candidate_name ? ` for ${r.candidate_name}` : ""} was <b>rejected</b> by ${approverName} (${approverRole}).</p>`,
    });
    return { status: "rejected", candidate: r.candidate_name, approverName, approverRole };
  } catch (e) {
    console.log("[rewards] decideManagerApproval failed:", e);
    return { status: "error" };
  }
}
