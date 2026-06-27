import { NextResponse } from "next/server";
import { outlookConfigured, createOutlookSubscription, listOutlookSubscriptions, renewOutlookSubscription } from "@/lib/outlook";

export const dynamic = "force-dynamic";

// Create or renew the Outlook Inbox subscription. Graph mail subscriptions expire
// in ~3 days, so run this on a daily cron. Protected by CRON_SECRET.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!outlookConfigured()) {
    return NextResponse.json({ ok: false, error: "Outlook env not configured" }, { status: 200 });
  }

  const notificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/outlook`;
  try {
    const subs = await listOutlookSubscriptions();
    const mine = subs.find((s: any) => s.notificationUrl === notificationUrl);
    if (mine) {
      const r = await renewOutlookSubscription(mine.id);
      return NextResponse.json({ ok: true, action: "renewed", id: mine.id, expires: r.expirationDateTime });
    }
    const created = await createOutlookSubscription();
    return NextResponse.json({ ok: true, action: "created", id: created.id, expires: created.expirationDateTime });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
