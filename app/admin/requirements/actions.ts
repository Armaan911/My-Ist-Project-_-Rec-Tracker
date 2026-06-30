"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyAllocation } from "@/lib/notify";

export async function createClientCompany(input: { name: string; division_id: string | null }) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const supabase = createClient();
  const { data, error } = await supabase.from("clients").insert({ name: input.name, division_id: input.division_id }).select("id").single();
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, "client.create", "clients", data.id, { name: input.name });
  revalidatePath("/admin/requirements");
  return { ok: true };
}

export async function updateClient(input: { id: string; name: string; division_id: string | null }) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  if (!input.name?.trim()) return { ok: false, error: "Client name is required." };
  const supabase = createClient();
  const { error } = await supabase.from("clients").update({ name: input.name.trim(), division_id: input.division_id }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, "client.update", "clients", input.id, { name: input.name });
  revalidatePath("/admin/requirements");
  return { ok: true };
}

export async function deleteClient(id: string) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const supabase = createClient();
  // null out requirements pointing at this client so we don't orphan FK references
  await supabase.from("requirements").update({ client_id: null }).eq("client_id", id);
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, "client.delete", "clients", id, null);
  revalidatePath("/admin/requirements");
  return { ok: true };
}

export async function createRequirement(input: {
  division_id: string; client_id: string | null; title: string; job_code: string; positions: number; priority: string; status: string; date_received: string;
}) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const supabase = createClient();
  const { data, error } = await supabase.from("requirements").insert({
    division_id: input.division_id, client_id: input.client_id || null, title: input.title, job_code: input.job_code?.trim() || null,
    positions: input.positions, priority: input.priority || null, status: input.status as any, date_received: input.date_received,
  }).select("id").single();
  if (error) {
    if ((error as { code?: string }).code === "23505") return { ok: false, error: `A requirement with job code "${input.job_code?.trim()}" already exists.` };
    return { ok: false, error: error.message };
  }
  await logAudit(me.id, "requirement.create", "requirements", data.id, { title: input.title, job_code: input.job_code });
  revalidatePath("/admin/requirements");
  return { ok: true };
}

export async function allocate(input: { requirement_id: string; recruiter_id: string }) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const supabase = createClient();

  // Cross-division guard: a requirement can only go to a recruiter who belongs to its division.
  const { data: req } = await supabase.from("requirements").select("division_id, title, job_code, divisions(name)").eq("id", input.requirement_id).single();
  if (!req) return { ok: false, error: "Requirement not found." };
  const { data: membership } = await supabase
    .from("profile_divisions").select("division_id").eq("profile_id", input.recruiter_id).eq("division_id", req.division_id).maybeSingle();
  if (!membership) {
    const divName = (req as any).divisions?.name ?? "another";
    return { ok: false, error: `This recruiter is not in the ${divName} division, so this requirement can't be allocated to them. Add the division to their profile first, or pick a recruiter in ${divName}.` };
  }

  const { data, error } = await supabase.from("allocations").insert({
    requirement_id: input.requirement_id, recruiter_id: input.recruiter_id,
    allocation_date: new Date().toISOString().slice(0, 10), allocated_by: me.id,
  }).select("id").single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That recruiter is already assigned to this requirement." };
    return { ok: false, error: error.message };
  }
  await logAudit(me.id, "allocation.create", "requirements", input.requirement_id, { recruiter_id: input.recruiter_id });
  await notifyAllocation({ recruiterId: input.recruiter_id, requirementTitle: (req as any).title ?? "a requirement", jobCode: (req as any).job_code ?? null });
  revalidatePath("/admin/requirements");
  return { ok: true, id: data.id };
}

export async function updateRequirement(input: {
  id: string; title: string; job_code: string; positions: number; priority: string; status: string;
}) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const supabase = createClient();
  const { error } = await supabase.from("requirements").update({
    title: input.title, job_code: input.job_code?.trim() || null, positions: input.positions, priority: input.priority || null, status: input.status as any,
  }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, "requirement.update", "requirements", input.id, { status: input.status });
  revalidatePath("/admin/requirements");
  return { ok: true };
}

export async function deleteRequirement(id: string) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const supabase = createClient();
  const { error } = await supabase.from("requirements").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, "requirement.delete", "requirements", id, null);
  revalidatePath("/admin/requirements");
  return { ok: true };
}

export async function removeAllocation(id: string) {
  const me = await getProfile();
  if (me?.role !== "admin") return { ok: false, error: "Not authorized" };
  const supabase = createClient();
  const { error } = await supabase.from("allocations").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit(me.id, "allocation.remove", "allocations", id, null);
  revalidatePath("/admin/requirements");
  return { ok: true };
}
