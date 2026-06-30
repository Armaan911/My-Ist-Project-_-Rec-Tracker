"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { parseCsv, toCsvUrl } from "@/lib/fetchedProfiles";

export type ParsedSubRow = {
  candidate_name: string; email: string | null; linkedin: string | null;
  location: string | null; phone: string | null; date: string | null; status: string | null;
};
export type ImportedSub = {
  id: string; candidate_name: string; linkedin_url: string | null; location: string | null;
  email: string | null; phone: string | null; status: string; submitted_date: string; resume_url: string | null;
};

function field(row: Record<string, string>, ...aliases: string[]): string {
  const keys = Object.keys(row);
  for (const a of aliases) {
    const hit = keys.find((k) => k === a) ?? keys.find((k) => k.includes(a));
    if (hit && row[hit]) return row[hit];
  }
  return "";
}

// Auto-map sheet columns by header name to our fields.
function toRow(row: Record<string, string>): ParsedSubRow {
  const rawDate = field(row, "date", "submitted", "submission");
  let date: string | null = null;
  if (rawDate) { const d = new Date(rawDate); if (!isNaN(d.getTime())) date = d.toISOString().slice(0, 10); }
  return {
    candidate_name: field(row, "name", "candidate"),
    email: field(row, "email", "e-mail") || null,
    linkedin: field(row, "linkedin", "linked in", "profile url") || null,
    location: field(row, "location", "city") || null,
    phone: field(row, "phone", "mobile", "contact") || null,
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
  const labelById = new Map(((statuses ?? []) as any[]).map((s) => [s.id, s.label]));
  const matchStatus = (raw: string | null) => {
    const t = (raw ?? "").trim().toLowerCase();
    return (t && (byLabel.get(t) ?? byCode.get(t))) || input.defaultStatusId;
  };

  const t = await getText(input);
  if (!t.ok) return { ok: false as const, error: t.error };
  const rows = parseCsv(t.text).map(toRow).filter((r) => r.candidate_name);
  if (!rows.length) return { ok: false as const, error: "No candidate rows found." };

  const today = new Date().toISOString().slice(0, 10);
  const created: ImportedSub[] = [];
  let skipped = 0; // rows whose candidate (LinkedIn) was already submitted for this requirement
  for (const r of rows) {
    const statusId = matchStatus(r.status);
    const date = r.date ?? today;
    const { data: ins, error } = await admin.from("submissions").insert({
      recruiter_id: me.id, requirement_id: input.requirementId, division_id: divisionId,
      candidate_name: r.candidate_name, candidate_email: r.email, linkedin_url: r.linkedin,
      phone: r.phone, current_location: r.location,
      current_status_id: statusId, submitted_date: date,
    }).select("id").single();
    if (!error && ins) {
      const id = (ins as any).id as string;
      await admin.from("submission_status_history").insert({ submission_id: id, old_status_id: null, new_status_id: statusId, changed_by: me.id });
      created.push({
        id, candidate_name: r.candidate_name, linkedin_url: r.linkedin, location: r.location,
        email: r.email, phone: r.phone, status: labelById.get(statusId) ?? "—", submitted_date: date, resume_url: null,
      });
    } else if ((error as { code?: string } | null)?.code === "23505") {
      skipped++;
    }
  }
  if (created.length === 0) return { ok: false as const, error: skipped ? `All ${skipped} candidate(s) were already submitted for this requirement (duplicate LinkedIn).` : "Could not save any submissions." };
  revalidatePath("/dashboard"); revalidatePath("/manager"); revalidatePath("/admin/teams");
  return { ok: true as const, count: created.length, rows: created, skipped };
}

// Attach/replace a resume on one of the recruiter's own submissions (admins: any).
export async function setSubmissionResume(id: string, url: string | null) {
  const me = (await getProfile()) as any;
  if (!me) return { ok: false, error: "Not signed in" };
  const admin = createAdminClient();
  const { data: sub } = await admin.from("submissions").select("recruiter_id").eq("id", id).maybeSingle();
  if (!sub) return { ok: false, error: "Submission not found" };
  if (me.role !== "admin" && (sub as any).recruiter_id !== me.id) return { ok: false, error: "Not authorized" };
  const { error } = await admin.from("submissions").update({ resume_url: url }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
