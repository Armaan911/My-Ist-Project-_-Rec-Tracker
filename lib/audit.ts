import { createAdminClient } from "@/lib/supabase/admin";

// Best-effort audit write (service role bypasses RLS). Never throws into the caller.
export async function logAudit(actorId: string | null, action: string, entityType: string, entityId: string | null, detail?: any) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      actor_id: actorId, action, entity_type: entityType, entity_id: entityId ?? null, detail: detail ?? null,
    });
  } catch {
    /* swallow — auditing must not break the action */
  }
}
