import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import { statusLabel } from "@/lib/fetchedProfiles";

export const dynamic = "force-dynamic";

const TERMINAL = "(not_a_fit,rejected_tech,closure)";
const MILESTONES = "(internal_submission,client_submission,closure)";

// Daily: (1) email + notify recruiters who still have open candidates to update,
// (2) send each AI-team member a single digest of the day's non-milestone status changes.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();

  // ---- 1) Reminders to recruiters with still-open (non-terminal) profiles ----
  let remindedRecruiters = 0;
  const { data: open } = await admin.from("fetched_profiles").select("id").not("status", "in", TERMINAL);
  const openIds = ((open ?? []) as { id: string }[]).map((p) => p.id);
  if (openIds.length) {
    const { data: pocs } = await admin.from("fetched_profile_pocs").select("recruiter_id").in("fetched_profile_id", openIds);
    const countByRec = new Map<string, number>();
    for (const p of (pocs ?? []) as { recruiter_id: string }[]) countByRec.set(p.recruiter_id, (countByRec.get(p.recruiter_id) ?? 0) + 1);

    const recIds = [...countByRec.keys()];
    const { data: recs } = recIds.length ? await admin.from("profiles").select("id, email, full_name").in("id", recIds) : { data: [] as any[] };
    const recById = new Map(((recs ?? []) as any[]).map((r) => [r.id, r]));

    for (const [rid, n] of countByRec) {
      await notify({
        userIds: [rid], type: "message", title: "Update your AI-team candidates",
        body: `You have ${n} candidate${n === 1 ? "" : "s"} awaiting a status update.`, link: "/dashboard",
      });
      const rec = recById.get(rid);
      if (rec?.email) {
        await sendEmail(
          rec.email,
          `Reminder: ${n} candidate${n === 1 ? "" : "s"} to update`,
          `<p>Hi ${rec.full_name ?? "there"},</p>
           <p>You have <strong>${n}</strong> AI-team candidate${n === 1 ? "" : "s"} still open. Please keep their status updated on your dashboard until each position is closed.</p>`,
        );
      }
      remindedRecruiters++;
    }
  }

  // ---- 2) Daily digest of non-milestone status changes, per AI-team member ----
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: changed } = await admin.from("fetched_profiles")
    .select("ai_team_id, candidate_name, status, requirements(title)")
    .gte("status_changed_at", since)
    .not("status", "in", MILESTONES);
  const byAi = new Map<string, string[]>();
  for (const c of (changed ?? []) as any[]) {
    if (!c.ai_team_id) continue;
    const role = (c.requirements as any)?.title ? ` (${(c.requirements as any).title})` : "";
    const line = `${c.candidate_name ?? "Candidate"} → ${statusLabel(c.status)}${role}`;
    const arr = byAi.get(c.ai_team_id) ?? []; arr.push(line); byAi.set(c.ai_team_id, arr);
  }
  let digests = 0;
  for (const [aiId, lines] of byAi) {
    await notify({
      userIds: [aiId], type: "message",
      title: `${lines.length} candidate status update${lines.length === 1 ? "" : "s"}`,
      body: lines.slice(0, 15).join(" · "), link: "/ai",
    });
    digests++;
  }

  return NextResponse.json({ remindedRecruiters, digests });
}
