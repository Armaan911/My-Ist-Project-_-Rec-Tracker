"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { isValidStatus, statusLabel, isMilestoneStatus } from "@/lib/fetchedProfiles";
import { sendEmail } from "@/lib/email";

type Me = { id: string; role: string; full_name?: string | null };

// A POC recruiter (or admin) may act on a fetched profile assigned to them.
async function loadOwned(admin: ReturnType<typeof createAdminClient>, id: string, me: Me) {
  const { data } = await admin.from("fetched_profiles").select("id, ai_team_id, candidate_name, status, requirements(title)").eq("id", id).maybeSingle();
  if (!data) return null;
  if (me.role !== "admin") {
    const { data: poc } = await admin.from("fetched_profile_pocs").select("recruiter_id").eq("fetched_profile_id", id).eq("recruiter_id", me.id).maybeSingle();
    if (!poc) return null;
  }
  const d = data as any;
  return {
    id: d.id as string, ai_team_id: d.ai_team_id as string | null, candidate_name: d.candidate_name as string | null,
    status: d.status as string, requirement_title: (d.requirements as any)?.title ?? null as string | null,
  };
}

export async function updateFetchedStatus(id: string, status: string) {
  const me = (await getProfile()) as Me | null;
  if (!me) return { ok: false, error: "Not signed in" };
  if (!isValidStatus(status)) return { ok: false, error: "Invalid status" };
  const admin = createAdminClient();
  const prof = await loadOwned(admin, id, me);
  if (!prof) return { ok: false, error: "Not authorized" };

  const now = new Date().toISOString();
  await admin.from("fetched_profiles").update({ status, updated_at: now, status_changed_at: now }).eq("id", id);

  // Milestones (internal/client submission, closure) notify the AI team instantly + email.
  // Every other change is batched into the daily digest (see the fetched-reminders cron).
  if (prof.ai_team_id && isMilestoneStatus(status)) {
    const role = prof.requirement_title ?? "the role";
    const cand = prof.candidate_name ?? "a candidate";
    await notify({
      userIds: [prof.ai_team_id], type: "message", title: `${statusLabel(status)}: ${cand}`,
      body: `${me.full_name ?? "A recruiter"} marked ${cand} as “${statusLabel(status)}” for ${role}.`,
      link: "/ai",
    });
    const { data: aiUser } = await admin.from("profiles").select("email, full_name").eq("id", prof.ai_team_id).maybeSingle();
    const email = (aiUser as any)?.email as string | undefined;
    if (email) {
      await sendEmail(
        email,
        `${statusLabel(status)} — ${cand} (${role})`,
        `<p>Hi ${(aiUser as any)?.full_name ?? "there"},</p>
         <p><strong>${me.full_name ?? "A recruiter"}</strong> updated a candidate you sourced:</p>
         <ul>
           <li><strong>Candidate:</strong> ${cand}</li>
           <li><strong>Job role:</strong> ${role}</li>
           <li><strong>Status:</strong> ${statusLabel(status)}</li>
         </ul>
         <p>Open the AI desk to review.</p>`,
      );
    }
  }
  revalidatePath("/dashboard");
  revalidatePath("/ai");
  return { ok: true };
}

export async function setFetchedResume(id: string, url: string | null) {
  const me = (await getProfile()) as Me | null;
  if (!me) return { ok: false, error: "Not signed in" };
  const admin = createAdminClient();
  const prof = await loadOwned(admin, id, me);
  if (!prof) return { ok: false, error: "Not authorized" };
  await admin.from("fetched_profiles").update({ resume_url: url, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setFetchedComment(id: string, comment: string) {
  const me = (await getProfile()) as Me | null;
  if (!me) return { ok: false, error: "Not signed in" };
  const admin = createAdminClient();
  const prof = await loadOwned(admin, id, me);
  if (!prof) return { ok: false, error: "Not authorized" };
  await admin.from("fetched_profiles").update({ recruiter_comment: comment.trim() || null, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/dashboard");
  revalidatePath("/ai");
  return { ok: true };
}
