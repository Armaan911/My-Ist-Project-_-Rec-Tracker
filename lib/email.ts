import { outlookConfigured, sendOutlookMail } from "@/lib/outlook";

// Unified mail sender. Transport priority:
//   1. Microsoft Graph / Outlook  — when MS_* + OUTLOOK_MAILBOX are set
//   2. Resend                     — when RESEND_API_KEY is set
//   3. Console log                — otherwise (local dev / not configured)
// Returns true only if a transport actually accepted the message (so callers like
// password-reset can tell the user when mail delivery is not configured/working).
export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  opts?: { replyTo?: string | null; from?: string | null },
): Promise<boolean> {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) return false;

  // 1) Microsoft Graph (Outlook). Send AS the actor's mailbox when `from` is given;
  //    if that mailbox can't send (e.g. a demo/non-tenant address), retry from the
  //    default monitored mailbox before giving up.
  if (outlookConfigured()) {
    const sendAs = (mailbox?: string | null) =>
      sendOutlookMail(recipients, subject, html, { replyTo: opts?.replyTo ?? null, from: mailbox ?? null });
    try {
      await sendAs(opts?.from);
      return true;
    } catch (e) {
      if (opts?.from) {
        try { await sendAs(null); return true; }
        catch (e2) { console.log("[email] outlook send failed (actor + default):", e2); }
      } else {
        console.log("[email] outlook send failed, falling back:", e);
      }
    }
  }

  // 2) Resend
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] (not sent — no transport) to=${recipients.join(",")} subject="${subject}"${opts?.replyTo ? ` reply_to=${opts.replyTo}` : ""}`);
    return false;
  }
  try {
    const body: Record<string, unknown> = { from: process.env.DAILY_FROM_EMAIL, to: recipients, subject, html };
    if (opts?.replyTo) body.reply_to = opts.replyTo;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) { console.log("[email] send failed", e); return false; }
}
