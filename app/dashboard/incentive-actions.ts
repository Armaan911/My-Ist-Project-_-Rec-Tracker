"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendManagerApprovalRequest } from "@/lib/rewards";

// A recruiter requests an incentive. Creates a pending request and fans out one-click
// approve/reject links (+ in-app pings) to their manager(s) and the admins.
export async function requestIncentive(input: { candidate_name?: string; reason: string }) {
  const me = await getProfile();
  if (!me) return { ok: false, error: "Not signed in." };

  const reason = (input.reason || "").trim();
  if (!reason) return { ok: false, error: "Tell us what the incentive is for." };
  const candidate = (input.candidate_name || "").trim();
  if (!candidate) return { ok: false, error: "Candidate name is required." };

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("full_name, email, division_id").eq("id", me.id).maybeSingle();
  const recruiterName = (prof as { full_name?: string } | null)?.full_name ?? "A recruiter";
  const recruiterEmail = (prof as { email?: string } | null)?.email ?? null;
  const divisionId = (prof as { division_id?: string | null } | null)?.division_id ?? (me as { division_id?: string | null }).division_id ?? null;

  const { data: inserted, error } = await admin.from("reward_requests").insert({
    recruiter_id: me.id, division_id: divisionId, candidate_name: candidate,
    requirement_title: null, status: "pending_manager", source: "recruiter_request", note: reason,
  }).select("id").single();
  if (error || !inserted) return { ok: false, error: error?.message ?? "Could not create the request." };

  await sendManagerApprovalRequest((inserted as { id: string }).id, { divisionId, recruiterName, recruiterEmail, candidate, reason });
  await logAudit(me.id, "incentive.request", "reward_requests", (inserted as { id: string }).id, { reason, candidate });

  revalidatePath("/dashboard");
  revalidatePath("/manager/rewards");
  revalidatePath("/admin/rewards");
  return { ok: true };
}
