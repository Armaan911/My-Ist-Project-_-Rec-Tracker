"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { parseCsv, toCsvUrl } from "@/lib/fetchedProfiles";

export type ParsedSubRow = { candidate_name: string; email: string | null; date: string | null; status: string | null };

function field(row: Record<string, string>, ...aliases: string[]): string {
  const keys = Object.keys(row);
  for (const a of aliases) {
    const hit = keys.find((k) => k === a) ?? keys.find((k) => k.includes(a));
    if (hit && row[hit]) return row[hit];
  }
  return "";
}

function toRow(row: Record<string, string>): ParsedSubRow {
  const rawDate = field(row, "date", "submitted", "submission");
  let date: string | null = null;
  if (rawDate) { const d = new Date(rawDate); if (!isNaN(d.getTime())) date = d.toISOString().slice(0, 10); }
  return {
    candidate_name: field(row, "name", "candidate"),
    email: field(row, "email", "e-mail") || null,
    date,
    status: field(row, "status", "stage") || null,
  };
}

async function getText(input: { csvText?: string; link?: string }): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  let text = (input.csvText ?? "").trim();
  if (!text && input.link) {
    try {
      const res = await fetch(toCsvUrl(input.link), { redirect: "follow" });
      if (!res.ok) return { ok: false, error: `Couldn't read the sheet (HTTP ${res.status}). Share it as “anyone with the link”.` };
      text = await res.text();
      if (text.trim().startsWith("<")) return { ok: false, error: "That link returned a web page, not CSV." };
    } catch (e: any) { return { ok: false, error: "Couldn't fetch the link: " + (e?.message ?? "error") }; }
  }
  if (!text) return { ok: false, error: "Provide a sheet/CSV link or upload a CSV file." };
  return { ok: true, text };
}

// Only a recruiter the admin has granted import access to.
async function ensureAllowed() {
  const me = (await getProfile()) as any;
  if (!me || me.role !== "recruiter" || !me.can_import_submissions) return null;
  return me;
}

export async function previewSubmissionImport(input: { csvText?: string; link?: string }) {
  const me = await ensureAllowed();
  if (!me) return { ok: false as const, error: "Not authorized" };
  const t = await getText(input);
  if (!t.ok) return { ok: false as const, error: t.error };
  const rows = parseCsv(t.text).map(toRow).filter((r) => r.candidate_name);
  if (!rows.length) return { ok: false as const, error: "No rows found — the sheet needs at least a candidate name column." };
  return { ok: true as const, rows };
}

export async function importPreviousSubmissions(input: { csvText?: string; link?: string; requirementId: string; defaultStatusId: string }) {
  const me = await ensureAllowed();
  if (!me) return { ok: false as const, error: "Not authorized" };
  if (!input.requirementId) return { ok: false as const, error: "Pick a requirement." };
  if (!input.defaultStatusId) return { ok: false as const, error: "Pick a default status." };
  const admin = createAdminClient();

  const { data: req } = await admin.from("requirements").select("id, division_id").eq("id", input.requirementId).maybeSingle();
  if (!req) return { ok: false as const, error: "Requirement not found." };
  const divisionId = (req as any).division_id ?? me.division_id;
  if (!divisionId) return { ok: false as const, error: "That requirement has no division." };

  const { data: statuses } = await admin.from("submission_statuses").select("id, code, label").eq("is_active", true);
  const byLabel = new Map(((statuses ?? []) as any[]).map((s) => [String(s.label).toLowerCase(), s.id]));
  const byCode = new Map(((statuses ?? []) as any[]).map((s) => [String(s.code).toLowerCase(), s.id]));
  const matchStatus = (raw: string | null) => {
    const t = (raw ?? "").trim().toLowerCase();
    return (t && (byLabel.get(t) ?? byCode.get(t))) || input.defaultStatusId;
  };

  const t = await getText(input);
  if (!t.ok) return { ok: false as const, error: t.error };
  const rows = parseCsv(t.text).map(toRow).filter((r) => r.candidate_name);
  if (!rows.length) return { ok: false as const, error: "No candidate rows found." };

  const today = new Date().toISOString().slice(0, 10);
  let created = 0;
  for (const r of rows) {
    const statusId = matchStatus(r.status);
    const { data: ins, error } = await admin.from("submissions").insert({
      recruiter_id: me.id, requirement_id: input.requirementId, division_id: divisionId,
      candidate_name: r.candidate_name, candidate_email: r.email,
      current_status_id: statusId, submitted_date: r.date ?? today,
    }).select("id").single();
    if (!error && ins) {
      created++;
      await admin.from("submission_status_history").insert({ submission_id: (ins as any).id, old_status_id: null, new_status_id: statusId, changed_by: me.id });
    }
  }
  if (created === 0) return { ok: false as const, error: "Could not save any submissions." };
  revalidatePath("/dashboard"); revalidatePath("/manager"); revalidatePath("/admin/teams");
  return { ok: true as const, count: created };
}
