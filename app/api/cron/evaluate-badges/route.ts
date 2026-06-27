import { NextResponse } from "next/server";
import { evaluateAllRecruiters } from "@/lib/badges";

export const dynamic = "force-dynamic";

// Nightly sweep: awards time-based + comparative badges (Top Submitter, Recruiter of the
// Month, Consistent Recruiter, etc.) that aren't triggered by a single recruiter action.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await evaluateAllRecruiters();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
