"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { parseCsv, rowToFetched, toCsvUrl, isValidStatus } from "@/lib/fetchedProfiles";
import ExcelJS from "exceljs";

const AI_EDITABLE = ["candidate_name", "linkedin_url", "location", "email", "phone", "open_to_work", "ownership", "status"];

// Resolve the OWNER of a profile from its ownership column → an AI-team member (by name/
// email/first-name), falling back to the importer so it always shows on someone's desk.
type OwnerRef = { id: string; name: string; email: string };
async function loadOwners(admin: ReturnType<typeof createAdminClient>): Promise<OwnerRef[]> {
  const { data } = await admin.from("profiles").select("id, full_name, email").eq("role", "ai_team");
  return ((data ?? []) as any[]).map((p) => ({ id: p.id, name: (p.full_name ?? "").toLowerCase(), email: (p.email ?? "").toLowerCase() }));
}
function matchOwner(ownership: string | null | undefined, owners: OwnerRef[], fallbackId: string): string {
  const t = (ownership ?? "").trim().toLowerCase();
  if (t) for (const o of owners) {
    if (o.name === t || o.email === t || (o.name && (o.name.startsWith(t + " ") || o.name.split(" ")[0] === t))) return o.id;
  }
  return fallbackId;
}

// AI team / admin edit any field on a parsed candidate (recruiters can only change status).
export async function aiUpdateProfile(id: string, patch: Record<string, any>) {
  const me = await getProfile();
  if (!me || (me.role !== "ai_team" && me.role !== "admin")) return { ok: false as const, error: "Not authorized" };
  const clean: Record<string, any> = {};
  for (const k of AI_EDITABLE) if (k in patch) clean[k] = patch[k];
  if (Object.keys(clean).length === 0) return { ok: false as const, error: "Nothing to update" };
  if ("status" in clean && !isValidStatus(clean.status)) return { ok: false as const, error: "Invalid status" };
  const now = new Date().toISOString();
  clean.updated_at = now;
  if ("status" in clean) clean.status_changed_at = now;
  const admin = createAdminClient();
  if ("ownership" in clean) {
    const owners = await loadOwners(admin);
    const { data: cur } = await admin.from("fetched_profiles").select("ai_team_id").eq("id", id).maybeSingle();
    clean.owner_id = matchOwner(clean.ownership, owners, (cur as any)?.ai_team_id ?? me.id);
  }
  const { error } = await admin.from("fetched_profiles").update(clean).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/ai"); revalidatePath("/dashboard");
  return { ok: true as const };
}

// AI team / admin delete parsed candidates they own or imported (admins: any). Replacing a
// sheet = delete + re-import. POC rows cascade.
export async function aiDeleteProfiles(ids: string[]) {
  const me = await getProfile();
  if (!me || (me.role !== "ai_team" && me.role !== "admin")) return { ok: false as const, error: "Not authorized" };
  const clean = Array.from(new Set((ids ?? []).filter(Boolean)));
  if (clean.length === 0) return { ok: false as const, error: "Nothing selected to delete." };
  const admin = createAdminClient();
  let q = admin.from("fetched_profiles").delete().in("id", clean);
  if (me.role !== "admin") q = q.or(`owner_id.eq.${me.id},ai_team_id.eq.${me.id}`);
  const { error } = await q;
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/ai"); revalidatePath("/dashboard");
  return { ok: true as const, count: clean.length };
}

// AI team / admin replace or delete a parsed candidate's resume.
export async function aiSetResume(id: string, url: string | null) {
  const me = await getProfile();
  if (!me || (me.role !== "ai_team" && me.role !== "admin")) return { ok: false as const, error: "Not authorized" };
  const admin = createAdminClient();
  const { error } = await admin.from("fetched_profiles").update({ resume_url: url, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/ai"); revalidatePath("/dashboard");
  return { ok: true as const };
}

// exceljs cell values can be plain scalars or objects (hyperlinks, rich text, formulas).
function cellText(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (typeof v.text === "string") return v.text;                                  // hyperlink cell
    if (Array.isArray(v.richText)) return v.richText.map((t: any) => t?.text ?? "").join("");
    if ("result" in v) return cellText(v.result);                                   // formula → result
    if (typeof v.hyperlink === "string") return v.hyperlink;
  }
  return String(v);
}

// Read the first worksheet of an .xlsx workbook into the same shape parseCsv produces
// (header row → lowercased keys), so the rest of the pipeline is unchanged.
async function xlsxToRows(buf: ArrayBuffer): Promise<Record<string, string>[]> {
  const wb = new ExcelJS.Workbook();
  // Buffer.from(ArrayBuffer) is correct at runtime; the cast sidesteps a @types/node
  // Buffer-generics mismatch with exceljs's load() signature.
  await wb.xlsx.load(Buffer.from(buf) as any);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const matrix: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = row.values as any[]; // 1-indexed: [empty, col1, col2, …]
    const cells: string[] = [];
    for (let c = 1; c < vals.length; c++) cells.push(cellText(vals[c]).trim());
    matrix.push(cells);
  });
  if (matrix.length === 0) return [];
  const headers = matrix[0].map((h) => h.trim().toLowerCase());
  return matrix.slice(1)
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => { const o: Record<string, string> = {}; headers.forEach((h, i) => (o[h] = r[i] ?? "")); return o; });
}

// Resolve tabular rows from an uploaded CSV's text, or a sheet/CSV/Excel link
// (Google Sheets, SharePoint/OneDrive Excel, or a direct CSV).
async function resolveRows(input: { csvText?: string; link?: string }): Promise<{ ok: true; rows: Record<string, string>[] } | { ok: false; error: string }> {
  const csvText = (input.csvText ?? "").trim();
  if (csvText) return { ok: true, rows: parseCsv(csvText) };
  if (!input.link) return { ok: false, error: "Provide a sheet/CSV link or upload a CSV file." };
  try {
    const res = await fetch(toCsvUrl(input.link), { redirect: "follow" });
    if (!res.ok) return { ok: false, error: `Couldn't read the file (HTTP ${res.status}). Share it as “anyone with the link”.` };
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    const buf = await res.arrayBuffer();
    const b = new Uint8Array(buf);
    const isZip = b.length > 3 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04; // "PK\x03\x04" → xlsx
    if (isZip || ct.includes("spreadsheetml") || ct.includes("officedocument") || ct.includes("application/vnd.ms-excel")) {
      const rows = await xlsxToRows(buf);
      if (rows.length === 0) return { ok: false, error: "That workbook had no readable rows — check the first sheet’s headers." };
      return { ok: true, rows };
    }
    const text = new TextDecoder("utf-8").decode(b);
    if (text.trim().startsWith("<")) return { ok: false, error: "That link returned a web page, not a sheet. Share it as “anyone with the link” (Google Sheet, SharePoint/OneDrive, or a CSV export link)." };
    return { ok: true, rows: parseCsv(text) };
  } catch (e: any) {
    return { ok: false, error: "Couldn't fetch the link: " + (e?.message ?? "unknown error") };
  }
}

// Parse a sheet/CSV (no DB write) so the AI team can review the tabulated rows before importing.
export async function previewFetched(input: { csvText?: string; link?: string }) {
  const me = await getProfile();
  if (!me || (me.role !== "ai_team" && me.role !== "admin")) return { ok: false as const, error: "Not authorized" };
  const t = await resolveRows(input);
  if (!t.ok) return { ok: false as const, error: t.error };
  const rows = t.rows.map(rowToFetched).filter((r) => r.candidate_name || r.email || r.linkedin_url);
  if (rows.length === 0) return { ok: false as const, error: "No candidate rows found — check the column headers." };
  return { ok: true as const, rows };
}

// AI team imports candidate rows from a sheet/CSV link or an uploaded CSV's text,
// creates fetched_profiles (all starting at "Yet to review"), assigns ALL rows to ALL POCs, notifies them.
export async function importFetchedProfiles(input: { csvText?: string; link?: string; requirementId?: string | null; pocIds: string[] }) {
  const me = await getProfile();
  if (!me || (me.role !== "ai_team" && me.role !== "admin")) return { ok: false as const, error: "Not authorized" };
  const pocIds = Array.from(new Set((input.pocIds ?? []).filter(Boolean)));
  if (pocIds.length === 0) return { ok: false as const, error: "Pick at least one POC recruiter." };

  const t = await resolveRows(input);
  if (!t.ok) return { ok: false as const, error: t.error };
  const rows = t.rows.map(rowToFetched).filter((r) => r.candidate_name || r.email || r.linkedin_url);
  if (rows.length === 0) return { ok: false as const, error: "No candidate rows found — check the column headers." };

  const admin = createAdminClient();
  const owners = await loadOwners(admin);
  const inserted: string[] = [];
  let skipped = 0; // candidate (LinkedIn) already parsed for this requirement
  for (const r of rows) {
    const { data, error } = await admin.from("fetched_profiles").insert({
      requirement_id: input.requirementId || null, ai_team_id: me.id,
      owner_id: matchOwner(r.ownership, owners, me.id), // shows on the owner's AI desk (per ownership column)
      candidate_name: r.candidate_name, linkedin_url: r.linkedin_url, location: r.location,
      email: r.email, phone: r.phone, open_to_work: r.open_to_work, ownership: r.ownership,
      status: "yet_to_review", // every imported candidate waits for a recruiter to review
    }).select("id").single();
    if (!error && data) inserted.push((data as { id: string }).id);
    else if ((error as { code?: string } | null)?.code === "23505") skipped++;
  }
  if (inserted.length === 0) return { ok: false as const, error: skipped ? `All ${skipped} candidate(s) are already parsed for this requirement (duplicate LinkedIn).` : "Could not save the rows." };

  const links = inserted.flatMap((pid) => pocIds.map((rid) => ({ fetched_profile_id: pid, recruiter_id: rid })));
  await admin.from("fetched_profile_pocs").insert(links);

  await notify({
    userIds: pocIds, type: "message", title: "New AI-team profiles to review",
    body: `${inserted.length} candidate profile${inserted.length === 1 ? "" : "s"} were assigned to you to review.`,
    link: "/dashboard",
  });

  revalidatePath("/ai");
  revalidatePath("/dashboard");
  return { ok: true as const, count: inserted.length, skipped };
}
