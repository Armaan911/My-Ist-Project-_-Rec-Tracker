// Server-only module: uses the service-role admin client. Never import into a client component.
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { appOrigin } from "@/lib/origin";

export type NotificationType =
  | "approval_request"
  | "approval_approved"
  | "approval_rejected"
  | "badge"
  | "daily_reminder"
  | "allocation"
  | "message";

type NotifyInput = {
  userIds: string[];
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  metadata?: Record<string, unknown>;
};

// Create in-app notifications for one or more recipients.
// Best-effort & defensive: it NEVER throws into the caller, so a missing table
// (before the migration is applied) or a transient error can't break the
// surrounding flow (saving a day, approving a change, awarding a badge, a cron).
export async function notify(input: NotifyInput): Promise<void> {
  const ids = Array.from(new Set((input.userIds ?? []).filter(Boolean)));
  if (ids.length === 0) return;
  try {
    const admin = createAdminClient();
    const rows = ids.map((user_id) => ({
      user_id,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      metadata: input.metadata ?? {},
    }));
    const { error } = await admin.from("notifications").insert(rows);
    if (error) console.log("[notify] insert error:", error.message);
  } catch (e) {
    console.log("[notify] failed:", e);
  }
}

export type Recipient = { id: string; email: string | null; full_name: string; role: string };

// Who should review a recruiter's approval request: every active admin, plus the
// active managers of the recruiter's division (or all managers if no division).
export async function approvalReviewers(divisionId: string | null): Promise<Recipient[]> {
  try {
    const admin = createAdminClient();
    const { data: admins } = await admin
      .from("profiles").select("id, email, full_name, role")
      .eq("role", "admin").eq("is_active", true);

    // Every active manager is an approver (not only the division's), so any newly-created
    // manager automatically receives all approval requests too. divisionId kept for API compat.
    void divisionId;
    const { data: mg } = await admin
      .from("profiles").select("id, email, full_name, role")
      .eq("role", "manager").eq("is_active", true);
    const managers = (mg ?? []) as Recipient[];

    const all = [...((admins ?? []) as Recipient[]), ...managers];
    const seen = new Set<string>();
    return all.filter((p) => p && !seen.has(p.id) && (seen.add(p.id), true));
  } catch (e) {
    console.log("[notify] approvalReviewers failed:", e);
    return [];
  }
}

// Email a passwordless magic-link to a reviewer (manager/admin) that signs them in
// and lands on the approvals page so they can approve/reject. Best-effort.
// Requires NEXT_PUBLIC_APP_URL/<callback> to be in the Supabase Auth redirect allow-list
// and an email transport (Resend) configured; otherwise the link is logged, not sent.
export async function emailApprovalMagicLink(opts: {
  email: string;
  recruiterName: string;
  what: string;
  forDate?: string | null;
  fromEmail?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const base = appOrigin();
    // Generate a magic-link OTP, then wrap its token_hash in OUR own callback URL.
    // This keeps the whole flow on our domain (no Supabase redirect allow-list needed)
    // and uses the SSR-recommended verifyOtp(token_hash) server flow.
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: opts.email });
    const hashed = (data?.properties as { hashed_token?: string } | undefined)?.hashed_token;
    if (error || !hashed) {
      console.log("[notify] magiclink generate failed:", error?.message);
      return;
    }
    const link = `${base}/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=magiclink&next=${encodeURIComponent("/manager/approvals")}`;
    const subject = `Approval needed — ${opts.recruiterName}`;
    const html =
      `<p>${opts.recruiterName} has requested approval for <b>${opts.what}</b>${opts.forDate ? ` (${opts.forDate})` : ""}.</p>` +
      `<p><a href="${link}">Open approvals</a> to approve or reject — no password needed; the link signs you in and then expires.</p>`;
    await sendEmail(opts.email, subject, html, { from: opts.fromEmail ?? null, replyTo: opts.fromEmail ?? null });
  } catch (e) {
    console.log("[notify] emailApprovalMagicLink failed:", e);
  }
}

// ---- High-level event helpers (called from server actions / crons) ----

// A recruiter filed a change request: notify every reviewer in-app, and email a
// passwordless approve/reject link to the division's managers.
export async function notifyApprovalRequest(opts: {
  recruiterId: string;
  what: string;
  forDate?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: rec } = await admin
      .from("profiles").select("full_name, division_id, email").eq("id", opts.recruiterId).maybeSingle();
    const recruiterName = (rec as { full_name?: string } | null)?.full_name ?? "A recruiter";
    const divisionId = (rec as { division_id?: string | null } | null)?.division_id ?? null;
    const recruiterEmail = (rec as { email?: string | null } | null)?.email ?? null;

    const reviewers = await approvalReviewers(divisionId);
    if (reviewers.length === 0) return;

    await notify({
      userIds: reviewers.map((r) => r.id),
      type: "approval_request",
      title: `${recruiterName} requested approval`,
      body: `${opts.what}${opts.forDate ? ` · ${opts.forDate}` : ""}`,
      link: "/manager/approvals",
      metadata: { recruiterId: opts.recruiterId },
    });

    // Passwordless link to MANAGERS only (admins use the in-app approvals page).
    for (const m of reviewers.filter((r) => r.role === "manager" && r.email)) {
      await emailApprovalMagicLink({ email: m.email!, recruiterName, what: opts.what, forDate: opts.forDate ?? null, fromEmail: recruiterEmail });
    }
  } catch (e) {
    console.log("[notify] notifyApprovalRequest failed:", e);
  }
}

// A reviewer approved/rejected: tell the recruiter.
export async function notifyApprovalDecision(opts: {
  recruiterId: string;
  approved: boolean;
  what: string;
  forDate?: string | null;
}): Promise<void> {
  await notify({
    userIds: [opts.recruiterId],
    type: opts.approved ? "approval_approved" : "approval_rejected",
    title: opts.approved ? "Your edit was approved" : "Your edit was rejected",
    body: `${opts.what}${opts.forDate ? ` · ${opts.forDate}` : ""} was ${opts.approved ? "approved" : "rejected"}.`,
    link: "/dashboard",
  });
}

// A recruiter was assigned a requirement.
export async function notifyAllocation(opts: {
  recruiterId: string;
  requirementTitle: string;
  jobCode?: string | null;
}): Promise<void> {
  await notify({
    userIds: [opts.recruiterId],
    type: "allocation",
    title: "New requirement assigned",
    body: `You've been assigned to "${opts.requirementTitle}"${opts.jobCode ? ` (${opts.jobCode})` : ""}.`,
    link: "/dashboard",
  });
}

// A recruiter unlocked one or more badges/medals.
export async function notifyBadges(recruiterId: string, badgeNames: string[]): Promise<void> {
  const names = badgeNames.filter(Boolean);
  if (names.length === 0) return;
  await notify({
    userIds: [recruiterId],
    type: "badge",
    title: names.length === 1 ? `Badge unlocked: ${names[0]}` : `${names.length} badges unlocked!`,
    body: names.length === 1 ? "Nice work — keep it up!" : names.join(", "),
    link: "/dashboard",
  });
}
