import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { outlookConfigured, sendOutlookMail } from "@/lib/outlook";
import { mintDailyToken } from "@/lib/dailyToken";
import { appOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

const istDate = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const forDate = istDate();
  const base = appOrigin();

  const { data: recruiters, error } = await admin.from("profiles").select("id, full_name, email").eq("role", "recruiter").eq("is_active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const useOutlook = outlookConfigured();
  let sent = 0;
  for (const r of recruiters ?? []) {
    const minted = await mintDailyToken(admin, r.id, forDate);
    if (!minted.ok) continue;
    const link = `${base}/daily/${minted.token}`;
    const subject = "Your daily recruitment update";
    const html =
      `<p>Hi ${r.full_name},</p>` +
      `<p><b>Reply to this email</b> with today's numbers and we'll log them automatically. For example:</p>` +
      `<blockquote>Resumes sourced: 12<br/>Applicants parsed: 30<br/>Worked on: Acme backend role, chased 2 offers</blockquote>` +
      `<p>Prefer a form? Log it here (no login needed): <a href="${link}">${link}</a> — expires in 20 hours, works once.</p>`;

    try {
      if (useOutlook) await sendOutlookMail(r.email, subject, html); // replies route to the monitored mailbox
      else await sendEmail(r.email, subject, html);
      sent++;
    } catch (e) {
      console.log("[daily-tokens] send failed for", r.email, e);
    }
  }
  return NextResponse.json({ ok: true, for_date: forDate, sent, via: useOutlook ? "outlook" : "resend" });
}
