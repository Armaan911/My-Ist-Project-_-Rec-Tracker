"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { saveDailyItems } from "@/lib/dailyData";
import { evaluateAndAward } from "@/lib/badges";
import { notifyApprovalDecision } from "@/lib/notify";

type Me = { id: string; role: string; division_id: string | null };

const whatLabel = (entityType: string) =>
  entityType === "submission" ? "Submission edit" : "Daily update edit";

const dateOf = (p: { date?: string; activity_date?: string } | null) => p?.date ?? p?.activity_date ?? null;

// Admins may review any request; managers may review only recruiters in their division(s).
// Writes go through the service-role client (change_requests RLS only grants UPDATE to admins),
// gated in code — the same pattern used for manager allocations.
async function gateReviewer(recruiterId: string):
  Promise<{ ok: true; me: Me; admin: ReturnType<typeof createAdminClient> } | { ok: false; error: string }> {
  const me = (await getProfile()) as Me | null;
  if (!me || (me.role !== "admin" && me.role !== "manager")) return { ok: false, error: "Not authorized" };
  const admin = createAdminClient();
  if (me.role === "manager") {
    const { data: rec } = await admin.from("profiles").select("division_id").eq("id", recruiterId).maybeSingle();
    const div = (rec as { division_id?: string | null } | null)?.division_id ?? null;
    const { data: pd } = await admin.from("profile_divisions").select("division_id").eq("profile_id", me.id);
    const myDivs = new Set<string>((pd ?? []).map((r: { division_id: string }) => r.division_id));
    if (me.division_id) myDivs.add(me.division_id);
    if (!div || !myDivs.has(div)) return { ok: false, error: "This request is outside your division." };
  }
  return { ok: true, me, admin };
}

export async function approveChange(id: string) {
  const reader = createAdminClient();
  const { data: cr } = await reader
    .from("change_requests").select("id, entity_type, entity_id, recruiter_id, payload, status").eq("id", id).single();
  if (!cr || cr.status !== "pending") return { ok: false, error: "Not a pending request" };

  const g = await gateReviewer(cr.recruiter_id);
  if (!g.ok) return g;
  const { me, admin } = g;

  const p = cr.payload as { date?: string; activity_date?: string; items?: unknown[]; resumes_sourced?: number; applicants_parsed?: number; notes?: string; candidate_name?: string; current_status_id?: string };

  // Atomically claim the request BEFORE applying the payload, so a concurrent second reviewer
  // can't also apply the change (only the winner proceeds); revert to pending if the apply fails.
  const { data: claim } = await admin.from("change_requests")
    .update({ status: "approved", reviewed_by: me.id, reviewed_at: new Date().toISOString() })
    .eq("id", id).eq("status", "pending").select("id");
  if (!claim?.length) return { ok: false, error: "This request has already been reviewed." };
  const revert = async (msg: string) => {
    await admin.from("change_requests").update({ status: "pending", reviewed_by: null, reviewed_at: null }).eq("id", id);
    return { ok: false as const, error: msg };
  };

  // Apply the payload; any returned error OR thrown exception reverts the claim to pending.
  try {
    if (cr.entity_type === "daily_activity") {
      const { error } = await admin.from("daily_activity").update({
        resumes_sourced: p.resumes_sourced, applicants_parsed: p.applicants_parsed, notes: p.notes,
      }).eq("id", cr.entity_id);
      if (error) return revert(error.message);
    } else if (cr.entity_type === "daily_activity_item") {
      // Per-requirement past-day edit: apply, then keep the day locked so further edits re-queue.
      const res = await saveDailyItems(admin, cr.recruiter_id, p.date!, (p.items ?? []) as never[]);
      if (!res.ok) return revert(res.error ?? "Couldn't apply the change.");
      const { error: lockErr } = await admin.from("daily_activity_values").update({ is_locked: true }).eq("recruiter_id", cr.recruiter_id).eq("activity_date", p.date!);
      if (lockErr) console.error("[approveChange] re-lock day failed:", lockErr.message);
      await evaluateAndAward(cr.recruiter_id);
    } else if (cr.entity_type === "submission") {
      const patch: Record<string, unknown> = {};
      if (p.candidate_name !== undefined) patch.candidate_name = p.candidate_name;
      if (p.current_status_id !== undefined) patch.current_status_id = p.current_status_id;
      if (Object.keys(patch).length) {
        const { error } = await admin.from("submissions").update(patch).eq("id", cr.entity_id);
        if (error) return revert(error.message);
      }
    }
    await logAudit(me.id, "change_request.approve", cr.entity_type, cr.entity_id, p);
    await notifyApprovalDecision({ recruiterId: cr.recruiter_id, approved: true, what: whatLabel(cr.entity_type), forDate: dateOf(p) });
  } catch (e: any) {
    return revert(e?.message ?? "Couldn't apply the change.");
  }
  revalidatePath("/admin/approvals");
  revalidatePath("/manager/approvals");
  return { ok: true };
}

export async function rejectChange(id: string) {
  const reader = createAdminClient();
  const { data: cr } = await reader
    .from("change_requests").select("id, entity_type, recruiter_id, payload, status").eq("id", id).single();
  if (!cr || cr.status !== "pending") return { ok: false, error: "Not a pending request" };

  const g = await gateReviewer(cr.recruiter_id);
  if (!g.ok) return g;
  const { me, admin } = g;

  const { data: claim } = await admin.from("change_requests")
    .update({ status: "rejected", reviewed_by: me.id, reviewed_at: new Date().toISOString() })
    .eq("id", id).eq("status", "pending").select("id");
  if (!claim?.length) return { ok: false, error: "This request has already been reviewed." };
  await logAudit(me.id, "change_request.reject", "change_requests", id, null);
  const p = cr.payload as { date?: string; activity_date?: string };
  await notifyApprovalDecision({ recruiterId: cr.recruiter_id, approved: false, what: whatLabel(cr.entity_type), forDate: dateOf(p) });
  revalidatePath("/admin/approvals");
  revalidatePath("/manager/approvals");
  return { ok: true };
}
