"use client";
import { useState } from "react";
import { Plus, Search, Pencil, KeyRound, Trash2 } from "lucide-react";
import { createAccount, updateAccount, setUserPassword, sendPasswordReset, deleteAccount } from "@/app/admin/accounts/actions";
import { Avatar, Badge, Button, Card, Input, Label, Modal, Spinner } from "@/components/ui";
import { toast } from "@/components/uikit";
import ImageUpload from "@/components/ImageUpload";

type Division = { id: string; name: string };
type Profile = { id: string; full_name: string; email: string; role: string; division_id: string | null; division_ids?: string[]; monthly_submission_target: number | null; is_active: boolean; avatar_url?: string | null; is_coordinator?: boolean };

const ROLES = [
  { value: "recruiter", label: "Recruiter", desc: "Logs daily activity and submissions, tracks their own pipeline." },
  { value: "manager", label: "Manager", desc: "Sees the team dashboard, performance and alerts for their division." },
  { value: "hr", label: "HR", desc: "Reviews incentive requests — approves or denies payouts and sets the amount." },
  { value: "ai_team", label: "AI Team", desc: "Imports sourced candidate profiles from a sheet and assigns them to recruiters." },
  { value: "admin", label: "Admin", desc: "Full access — people, requirements, approvals and configuration." },
] as const;

const roleTone = (r: string) => (r === "admin" ? "brand" : r === "manager" ? "success" : r === "hr" ? "info" : r === "ai_team" ? "warning" : "neutral") as "brand" | "success" | "info" | "warning" | "neutral";

export default function AccountManager({ divisions, profiles }: { divisions: Division[]; profiles: Profile[] }) {
  const divName = (id: string | null) => divisions.find((d) => d.id === id)?.name ?? "—";
  const divNames = (ids?: string[]) => (ids && ids.length ? ids.map((id) => divName(id)).join(", ") : "—");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState<Profile | null>(null);

  const counts = {
    admin: profiles.filter((p) => p.role === "admin").length,
    manager: profiles.filter((p) => p.role === "manager").length,
    recruiter: profiles.filter((p) => p.role === "recruiter").length,
    hr: profiles.filter((p) => p.role === "hr").length,
    ai_team: profiles.filter((p) => p.role === "ai_team").length,
    inactive: profiles.filter((p) => !p.is_active).length,
  };
  const filtered = profiles.filter((p) => {
    if (roleFilter !== "all" && p.role !== roleFilter) return false;
    if (q && !`${p.full_name} ${p.email}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">People</h1>
          <p className="text-sm text-muted">Create and manage recruiter, manager and admin accounts.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus size={16} /> Add person</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Mini label="Recruiters" value={counts.recruiter} />
        <Mini label="Managers" value={counts.manager} />
        <Mini label="HR" value={counts.hr} />
        <Mini label="AI Team" value={counts.ai_team} />
        <Mini label="Admins" value={counts.admin} />
        <Mini label="Inactive" value={counts.inactive} />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="pl-9" />
          </div>
          <div className="flex rounded-lg border border-line p-0.5 text-sm">
            {["all", "recruiter", "manager", "hr", "ai_team", "admin"].map((r) => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`rounded-md px-3 py-1 capitalize ${roleFilter === r ? "bg-brand-600 text-white" : "text-muted hover:text-ink"}`}>
                {r === "all" ? "All" : r === "hr" ? "HR" : r === "ai_team" ? "AI Team" : r + "s"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr><th className="pb-2 font-medium">Person</th><th className="font-medium">Role</th><th className="font-medium">Divisions</th><th className="font-medium">Target</th><th className="font-medium">Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.full_name} src={p.avatar_url} />
                      <div><div className="font-medium">{p.full_name}</div><div className="text-xs text-muted">{p.email}</div></div>
                    </div>
                  </td>
                  <td><Badge tone={roleTone(p.role)} className="capitalize">{p.role}</Badge>{p.is_coordinator && <Badge tone="brand" className="ml-1">Coordinator</Badge>}</td>
                  <td className="text-muted">{p.role === "admin" ? "All divisions" : divNames(p.division_ids)}</td>
                  <td className="text-muted">{p.monthly_submission_target ?? "—"}</td>
                  <td>{p.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Inactive</Badge>}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(p)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-canvas hover:text-ink"><Pencil size={13} /> Edit</button>
                      <button onClick={() => setDeleting(p)} title="Delete" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-danger-50 hover:text-danger-600"><Trash2 size={13} /> Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm text-muted">No people match this filter. Add someone with the button above.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} divisions={divisions} />
      {editing && <EditModal person={editing} onClose={() => setEditing(null)} divisions={divisions} />}
      {deleting && <DeleteModal person={deleting} onClose={() => setDeleting(null)} onDone={() => setDeleting(null)} />}
    </div>
  );
}

function DeleteModal({ person, onClose, onDone }: { person: Profile; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    const res = await deleteAccount({ id: person.id });
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
    if ((res as { soft?: boolean }).soft) toast(`${person.full_name} had activity — sign-in removed and the account was deactivated (history kept).`, "success");
    else toast(`${person.full_name} deleted`, "success");
    onDone();
  }
  return (
    <Modal open onClose={onClose} title={`Delete ${person.full_name}?`} description={person.email}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={busy} onClick={confirm}>{busy ? <><Spinner /> Deleting…</> : "Delete user"}</Button>
      </>}>
      <p className="text-sm text-muted">
        This removes <b className="text-ink">{person.full_name}</b>&apos;s sign-in immediately. If they have history
        (submissions, daily activity, messages, rewards), the account is <b>deactivated</b> instead of fully deleted so
        your reports stay intact.
      </p>
    </Modal>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return <Card className="p-4"><div className="text-2xl font-bold">{value}</div><div className="text-xs uppercase tracking-wide text-muted">{label}</div></Card>;
}

function RolePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      {ROLES.map((r) => (
        <button key={r.value} type="button" onClick={() => onChange(r.value)}
          className={`w-full rounded-xl border p-3 text-left transition-colors ${value === r.value ? "border-brand-600 bg-brand-50" : "border-line hover:bg-canvas"}`}>
          <div className="flex items-center justify-between">
            <span className="font-medium capitalize">{r.label}</span>
            <span className={`h-3.5 w-3.5 rounded-full border ${value === r.value ? "border-brand-600 bg-brand-600" : "border-line"}`} />
          </div>
          <p className="mt-0.5 text-xs text-muted">{r.desc}</p>
        </button>
      ))}
    </div>
  );
}

// Multi-select division picker (checkboxes). The FIRST checked division becomes the recruiter's home/primary division.
function DivisionMultiPicker({ divisions, selected, onChange, disabled }: { divisions: Division[]; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  function toggle(id: string) {
    if (disabled) return;
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${disabled ? "opacity-50" : ""}`}>
      {divisions.map((d) => {
        const checked = selected.includes(d.id);
        const primary = checked && selected[0] === d.id;
        return (
          <button key={d.id} type="button" disabled={disabled} onClick={() => toggle(d.id)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${checked ? "border-brand-600 bg-brand-50" : "border-line hover:bg-canvas"}`}>
            <span className="flex items-center gap-2">
              <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] text-white ${checked ? "border-brand-600 bg-brand-600" : "border-line"}`}>{checked ? "✓" : ""}</span>
              {d.name}
            </span>
            {primary && <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-medium text-white">Primary</span>}
          </button>
        );
      })}
      {divisions.length === 0 && <p className="text-sm text-muted">No divisions configured yet.</p>}
    </div>
  );
}

function CreateModal({ open, onClose, divisions }: { open: boolean; onClose: () => void; divisions: Division[] }) {
  const [f, setF] = useState({ full_name: "", email: "", password: "", role: "recruiter", target: "", coordinator: false });
  const [divIds, setDivIds] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const needsDivision = f.role !== "admin" && f.role !== "hr" && f.role !== "ai_team";

  async function submit() {
    setErr(null);
    if (!f.full_name || !f.email || !f.password) return setErr("Name, email and a temporary password are required.");
    if (needsDivision && divIds.length === 0) return setErr("Recruiters and managers must be assigned to at least one division.");
    setSaving(true);
    const res = await createAccount({
      full_name: f.full_name, email: f.email, password: f.password, role: f.role as any,
      division_ids: needsDivision ? divIds : [], monthly_submission_target: f.target ? Number(f.target) : null,
      is_coordinator: f.role === "recruiter" ? f.coordinator : false,
    });
    setSaving(false);
    if (!res.ok) return setErr(res.error!);
    setF({ full_name: "", email: "", password: "", role: "recruiter", target: "", coordinator: false });
    setDivIds([]);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} wide title="Add a person"
      description="Creates a sign-in. Share the temporary password — they can change it and turn on 2FA after signing in."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={submit}>{saving ? <><Spinner /> Creating…</> : "Create account"}</Button></>}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <div><Label>Full name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} placeholder="Priya Sharma" /></div>
          <div><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="priya@company.com" /></div>
          <div><Label>Temporary password</Label><Input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="At least 8 characters" /></div>
          <div>
            <Label>Divisions{needsDivision ? " — pick one or more" : " (spans all divisions)"}</Label>
            <DivisionMultiPicker divisions={divisions} selected={divIds} onChange={setDivIds} disabled={!needsDivision} />
            {needsDivision && divIds.length > 1 && <p className="mt-1 text-xs text-muted">First pick (<b>{divisions.find((d) => d.id === divIds[0])?.name}</b>) is the home division; the rest grant cross-division access.</p>}
          </div>
          {f.role === "recruiter" && (
            <>
              <div><Label>Monthly submission target (optional)</Label><Input type="number" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="e.g. 25" /></div>
              <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                <span>Recruiter with <b>coordinator</b> access</span>
                <button type="button" role="switch" aria-checked={f.coordinator} onClick={() => setF({ ...f, coordinator: !f.coordinator })}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${f.coordinator ? "bg-brand-600" : "bg-line"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${f.coordinator ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                </button>
              </div>
            </>
          )}
        </div>
        <div>
          <Label>Role</Label>
          <RolePicker value={f.role} onChange={(v) => { setF({ ...f, role: v }); if (v === "admin" || v === "hr" || v === "ai_team") setDivIds([]); }} />
        </div>
      </div>
      {err && <p className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{err}</p>}
    </Modal>
  );
}

function EditModal({ person, onClose, divisions }: { person: Profile; onClose: () => void; divisions: Division[] }) {
  const [role, setRole] = useState(person.role);
  const [divIds, setDivIds] = useState<string[]>(person.division_ids ?? (person.division_id ? [person.division_id] : []));
  const [target, setTarget] = useState(person.monthly_submission_target?.toString() ?? "");
  const [active, setActive] = useState(person.is_active);
  const [avatar, setAvatar] = useState<string | null>(person.avatar_url ?? null);
  const [coordinator, setCoordinator] = useState(!!person.is_coordinator);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const needsDivision = role !== "admin" && role !== "hr" && role !== "ai_team";

  // password reset
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function applyPassword() {
    setPwMsg(null);
    if (newPw.length < 8) { setPwMsg({ ok: false, text: "Use at least 8 characters." }); return; }
    setPwBusy(true);
    const res = await setUserPassword({ id: person.id, password: newPw });
    setPwBusy(false);
    setPwMsg(res.ok ? { ok: true, text: `Password updated. Share it with ${person.full_name}.` } : { ok: false, text: res.error ?? "Failed" });
    if (res.ok) setNewPw("");
  }
  async function emailReset() {
    setPwMsg(null); setPwBusy(true);
    const res = await sendPasswordReset({ id: person.id });
    setPwBusy(false);
    setPwMsg(res.ok ? { ok: true, text: `Reset link emailed to ${person.email}.` } : { ok: false, text: res.error ?? "Failed" });
  }

  async function save() {
    setErr(null);
    if (needsDivision && divIds.length === 0) return setErr("Recruiters and managers need at least one division.");
    setSaving(true);
    const res = await updateAccount({ id: person.id, role: role as any, division_ids: needsDivision ? divIds : [], monthly_submission_target: target ? Number(target) : null, is_active: active, avatar_url: avatar, is_coordinator: role === "recruiter" ? coordinator : false });
    setSaving(false);
    if (!res.ok) return setErr(res.error!);
    onClose();
  }

  return (
    <Modal open onClose={onClose} wide title={person.full_name} description={person.email}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={save}>{saving ? <><Spinner /> Saving…</> : "Save changes"}</Button></>}>
      <div className="space-y-4">
        <div>
          <Label>Profile photo</Label>
          <ImageUpload bucket="avatars" prefix={person.id} value={avatar} onChange={setAvatar} label="Upload photo" />
        </div>
        <div><Label>Role</Label><RolePicker value={role} onChange={(v) => { setRole(v); if (v === "admin" || v === "hr" || v === "ai_team") setDivIds([]); }} /></div>
        <div>
          <Label>Divisions{needsDivision ? " — pick one or more" : ""}</Label>
          {needsDivision ? (
            <>
              <DivisionMultiPicker divisions={divisions} selected={divIds} onChange={setDivIds} />
              {divIds.length > 1 && <p className="mt-1 text-xs text-muted">First pick (<b>{divisions.find((d) => d.id === divIds[0])?.name}</b>) is the home division; the rest grant cross-division access.</p>}
            </>
          ) : <p className="text-sm text-muted">{role === "hr" ? "HR spans all divisions." : role === "ai_team" ? "The AI team isn't tied to a division." : "Admins span all divisions."}</p>}
        </div>
        <div><Label>Monthly submission target</Label><Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="—" /></div>
        {role === "recruiter" && (
          <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
            <span>Recruiter with <b>coordinator</b> access</span>
            <button type="button" role="switch" aria-checked={coordinator} onClick={() => setCoordinator(!coordinator)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${coordinator ? "bg-brand-600" : "bg-line"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${coordinator ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-line" />
          Account is active (can sign in)
        </label>

        <div className="rounded-xl border border-line bg-canvas/40 p-3">
          <div className="flex items-center gap-2 text-sm font-medium"><KeyRound size={14} className="text-brand-700" /> Reset password</div>
          <p className="mt-1 text-xs text-muted">Set a new password directly (works immediately — share it with the person), or email them a reset link so they set their own.</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <Label>New password</Label>
              <Input type="text" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="min 8 characters" />
            </div>
            <Button variant="secondary" size="sm" disabled={pwBusy || !newPw} onClick={applyPassword}>{pwBusy ? "…" : "Set password"}</Button>
            <Button variant="outline" size="sm" disabled={pwBusy} onClick={emailReset}>Email reset link</Button>
          </div>
          {pwMsg && <p className={`mt-2 text-xs font-medium ${pwMsg.ok ? "text-success-600" : "text-danger-600"}`}>{pwMsg.text}</p>}
        </div>
      </div>
      {err && <p className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{err}</p>}
    </Modal>
  );
}
