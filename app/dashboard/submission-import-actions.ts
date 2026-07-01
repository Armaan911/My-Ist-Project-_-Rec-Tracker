"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { parseCsv } from "@/lib/fetchedProfiles";
import { xlsxToRows } from "@/lib/xlsx";

export type ParsedSubRow = {
  candidate_name: string; email: string | null; linkedin: string | null;
  location: string | null; phone: string | null; date: string | null; status: string | null; job_code: string | null;
};
export type ImportedSub = {
  id: string; candidate_name: string; linkedin_url: string | null; location: string | null;
  email: string | null; phone: string | null; status: string; submitted_date: string; resume_url: string | null;
  requirement: string;
};

function field(row: Record<string, string>, ...aliases: string[]): string {
  const keys = Object.keys(row);
  for (const a of aliases) {
    const hit = keys.find((k) => k === a) ?? keys.find((k) => k.includes(a));
    if (hit && row[hit]) return row[hit];
  }
  return "";
}

// Sheet dates are typically DD/MM/YYYY (day-first). Parse to ISO (YYYY-MM-DD).
function parseSheetDate(raw: string): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let dd = Number(m[1]), mm = Number(m[2]); let yy = Number(m[3]);
    if (yy < 100) yy += 2000;
    if (mm > 12 && dd <= 12) { const t = dd; dd = mm; mm = t; } // month-first fallback
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      return `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Auto-map sheet columns by header name to our fields.
function toRow(row: Record<string, string>): ParsedSubRow {
  const date = parseSheetDate(field(row, "date", "submitted", "submission"));
  return {
    candidate_name: field(row, "name", "candidate"),
    email: field(row, "email", "e-mail") || null,
    linkedin: field(row, "linkedin", "linked in", "profile url") || null,
    location: field(row, "location", "city") || null,
    phone: field(row, "phone", "mobile", "contact") || null,
    date,
    status: field(row, "status", "stage") || null,
    job_code: field(row, "job code", "job_code", "jobcode", "requirement", "req code", "req id") || null,
  };
}

// Resolve tabular rows from an uploaded CSV (text) or an uploaded .csv/.xlsx file (base64).
async function resolveRows(input: { csvText?: string; fileB64?: string; fileName?: string }): Promise<{ ok: true; rows: Record<string, string>[] } | { ok: false; error: string }> {
  const csvText = (input.csvText ?? "").trim();
  if (csvText) return { ok: true, rows: parseCsv(csvText) };
  if (input.fileB64) {
    try {
      const buf = Buffer.from(input.fileB64, "base64");
      const isZip = buf.length > 3 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04; // xlsx = zip
      const isXlsx = isZip || (input.fileName ?? "").toLowerCase().endsWith(".xlsx");
      if (isXlsx) {
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        const rows = await xlsxToRows(ab);
        if (rows.length === 0) return { ok: false, error: "That workbook had no readable rows — check the first sheet's headers." };
        return { ok: true, rows };
      }
      return { ok: true, rows: parseCsv(buf.toString("utf8")) };
    } catch (e: any) { return { ok: false, error: "Couldn't read the file: " + (e?.message ?? "error") }; }
  }
  return { ok: false, error: "Upload a CSV or Excel (.xlsx) file." };
}

async function ensureAllowed() {
  const me = (await getProfile()) as any;
  if (!me || me.role !== "recruiter" || !me.can_import_submissions) return null;
  return me;
}

export async function previewSubmissionImport(input: { csvText?: string; fileB64?: string; fileName?: string }) {
  const me = await ensureAllowed();
  if (!me) return { ok: false as const, error: "Not authorized" };
  const t = await resolveRows(input);
  if (!t.ok) return { ok: false as const, error: t.error };
  const rows = t.rows.map(toRow).filter((r) => r.candidate_name);
  if (!rows.length) return { ok: false as const, error: "No rows found — the file needs at least a candidate name column." };
  return { ok: true as const, rows };
}

export async function importPreviousSubmissions(input: { csvText?: string; fileB64?: string; fileName?: string; requirementId: string; defaultStatusId: string }) {
  const me = await ensureAllowed();
  if (!me) return { ok: false as const, error: "Not authorized" };
  if (!input.requirementId) return { ok: false as const, error: "Pick a requirement." };
  if (!input.defaultStatusId) return { ok: false as const, error: "Pick a default status." };
  const admin = createAdminClient();

  // Load requirements so each row can map to its own requirement by job code (the
  // requirement's business key); rows without a matching code use the chosen default.
  const { data: allReqs } = await admin.from("requirements").select("id, title, job_code, division_id");
  const reqById = new Map(((allReqs ?? []) as any[]).map((r) => [r.id, r]));
  const reqByCode = new Map(((allReqs ?? []) as any[]).filter((r) => r.job_code).map((r) => [String(r.job_code).toLowerCase().trim(), r]));
  const defReq = reqById.get(input.requirementId);
  if (!defReq) return { ok: false as const, error: "Requirement not found." };

  const { data: statuses } = await admin.from("submission_statuses").select("id, code, label").eq("is_active", true);
  const byLabel = new Map(((statuses ?? []) as any[]).map((s) => [String(s.label).toLowerCase(), s.id]));
  const byCode = new Map(((statuses ?? []) as any[]).map((s) => [String(s.code).toLowerCase(), s.id]));
  const labelById = new Map(((statuses ?? []) as any[]).map((s) => [s.id, s.label]));
  const matchStatus = (raw: string | null) => {
    const t = (raw ?? "").trim().toLowerCase();
    return (t && (byLabel.get(t) ?? byCode.get(t))) || input.defaultStatusId;
  };

  const t = await resolveRows(input);
  if (!t.ok) return { ok: false as const, error: t.error };
  const rows = t.rows.map(toRow).filter((r) => r.candidate_name);
  if (!rows.length) return { ok: false as const, error: "No candidate rows found." };

  const today = new Date().toISOString().slice(0, 10);
  const created: ImportedSub[] = [];
  let skipped = 0; // duplicate LinkedIn for that requirement, or unplaceable rows
  for (const r of rows) {
    const req = (r.job_code && reqByCode.get(r.job_code.toLowerCase().trim())) || defReq;
    const divisionId = (req as any).division_id ?? me.division_id;
    if (!divisionId) { skipped++; continue; }
    const statusId = matchStatus(r.status);
    const date = r.date ?? today;
    const { data: ins, error } = await admin.from("submissions").insert({
      recruiter_id: me.id, requirement_id: (req as any).id, division_id: divisionId,
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
        requirement: (req as any).title,
      });
    } else if ((error as { code?: string } | null)?.code === "23505") {
      skipped++;
    }
  }
  if (created.length === 0) return { ok: false as const, error: skipped ? `All ${skipped} candidate(s) were already submitted (duplicate LinkedIn).` : "Could not save any submissions." };
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

// Edit the submitted date of one of the recruiter's own submissions (admins: any).
export async function setSubmissionDate(id: string, date: string) {
  const me = (await getProfile()) as any;
  if (!me) return { ok: false, error: "Not signed in" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Invalid date" };
  const admin = createAdminClient();
  const { data: sub } = await admin.from("submissions").select("recruiter_id").eq("id", id).maybeSingle();
  if (!sub) return { ok: false, error: "Submission not found" };
  if (me.role !== "admin" && (sub as any).recruiter_id !== me.id) return { ok: false, error: "Not authorized" };
  const { error } = await admin.from("submissions").update({ submitted_date: date }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
