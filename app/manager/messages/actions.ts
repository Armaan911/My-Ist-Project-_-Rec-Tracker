"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";

type Me = { id: string; role: string; division_id: string | null; full_name: string };

// Manager/admin broadcasts a message to selected recruiters (or everyone).
// Delivered both in-app (messages table) and as an email copy.
export async function sendManagerMessage(input: { recipient_ids: string[] | "all"; subject: string; body: string }) {
  const me = (await getProfile()) as Me | null;
  if (!me || (me.role !== "admin" && me.role !== "manager")) return { ok: false, error: "Not authorized" };
  if (!input.body?.trim()) return { ok: false, error: "Message body is empty." };

  const admin = createAdminClient();
  let query = admin.from("profiles").select("id, full_name, email").eq("role", "recruiter").eq("is_active", true);
  if (input.recipient_ids !== "all") {
    if (input.recipient_ids.length === 0) return { ok: false, error: "Pick at least one recruiter." };
    query = query.in("id", input.recipient_ids);
  }
  const { data: recipients, error: rErr } = await query;
  if (rErr) return { ok: false, error: rErr.message };
  if (!recipients || recipients.length === 0) return { ok: false, error: "No matching recruiters." };

  const isBroadcast = input.recipient_ids === "all";
  const rows = recipients.map((r) => ({
    sender_id: me.id,
    recipient_id: r.id,
    division_id: me.division_id,
    subject: input.subject?.trim() || null,
    body: input.body.trim(),
    is_broadcast: isBroadcast,
  }));
  const { error: insErr } = await admin.from("messages").insert(rows);
  if (insErr) return { ok: false, error: insErr.message };

  // email copy — sent FROM the manager's own mailbox (falls back to the default if unsendable)
  const { data: senderProf } = await admin.from("profiles").select("email").eq("id", me.id).maybeSingle();
  const senderEmail = (senderProf as { email?: string } | null)?.email ?? null;
  const subjectLine = input.subject?.trim() || `Message from ${me.full_name}`;
  const html = `<p>${escapeHtml(input.body.trim()).replace(/\n/g, "<br/>")}</p><p style="color:#888;font-size:12px">— ${escapeHtml(me.full_name)} via Podium</p>`;
  await sendEmail(recipients.map((r) => r.email).filter(Boolean), subjectLine, html, { from: senderEmail, replyTo: senderEmail });

  await logAudit(me.id, "message.send", "messages", null, { count: rows.length, broadcast: isBroadcast });
  revalidatePath("/manager/requirements");
  return { ok: true, count: rows.length };
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
