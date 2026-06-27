import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOutlookMessage } from "@/lib/outlook";
import { parseDailyReply } from "@/lib/parseDailyReply";

export const dynamic = "force-dynamic";

const istDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// Microsoft Graph hits this URL twice:
//  1) Subscription validation: POST/GET with ?validationToken=... -> echo it back as text/plain.
//  2) Change notifications:    POST { value: [ { clientState, resourceData: { id } }, ... ] }
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("validationToken");
  if (token) return new NextResponse(token, { status: 200, headers: { "Content-Type": "text/plain" } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  // validation handshake (Graph sends the token as a query param)
  const validationToken = req.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  const notifications: any[] = payload?.value ?? [];
  const secret = process.env.OUTLOOK_WEBHOOK_SECRET || "recruit-tracker";
  const admin = createAdminClient();

  for (const n of notifications) {
    try {
      if (n.clientState && n.clientState !== secret) continue; // reject spoofed callbacks
      const messageId = n.resourceData?.id;
      if (!messageId) continue;

      const msg = await getOutlookMessage(messageId);
      const fromEmail = msg.from?.emailAddress?.address?.toLowerCase();
      if (!fromEmail) continue;

      // sender must be an active recruiter
      const { data: recruiter } = await admin
        .from("profiles").select("id, division_id, is_active, role")
        .ilike("email", fromEmail).maybeSingle();
      if (!recruiter || !recruiter.is_active || recruiter.role !== "recruiter") continue;

      const isHtml = (msg.body?.contentType || "").toLowerCase() === "html";
      const parsed = parseDailyReply(msg.body?.content || msg.bodyPreview || "", isHtml);
      if (parsed.resumes_sourced == null && parsed.applicants_parsed == null && !parsed.notes) continue;

      const activity_date = istDate(msg.receivedDateTime);

      // respect the past-day lock: if locked, route the edit to the approvals queue instead
      const { data: existing } = await admin
        .from("daily_activity").select("id, is_locked")
        .eq("recruiter_id", recruiter.id).eq("activity_date", activity_date).maybeSingle();

      const values = {
        resumes_sourced: parsed.resumes_sourced ?? 0,
        applicants_parsed: parsed.applicants_parsed ?? 0,
        notes: parsed.notes,
      };

      if (existing?.is_locked) {
        await admin.from("change_requests").insert({
          entity_type: "daily_activity", entity_id: existing.id, recruiter_id: recruiter.id,
          payload: { activity_date, ...values }, reason: "Emailed update to a locked (past) day",
        });
        continue;
      }

      await admin.from("daily_activity").upsert(
        { recruiter_id: recruiter.id, division_id: recruiter.division_id, activity_date, ...values },
        { onConflict: "recruiter_id,activity_date" }
      );
    } catch (e) {
      console.log("[outlook-webhook] notification failed", e);
      // swallow — Graph retries, and one bad message must not drop the batch
    }
  }

  // Graph expects a fast 202
  return new NextResponse(null, { status: 202 });
}
