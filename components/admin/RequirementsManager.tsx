"use client";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Card, Input, Label, priorityTextClass, statusTextClass } from "@/components/ui";

type Div = { id: string; name: string };
type Client = { id: string; name: string; division_id?: string | null };
type Recruiter = { id: string; full_name: string; division_ids?: string[] };
type Req = { id: string; title: string; job_code?: string | null; positions: number; priority: string | null; status: string; date_received: string; division_id?: string | null; divisions?: { name: string } | null; clients?: { name: string } | null };
type Alloc = { id: string; requirement_id: string; recruiter_id: string; allocation_date: string; profiles?: { full_name: string } | null };
type Result = { ok: boolean; error?: string; id?: string };

type Actions = {
  createClientCompany: (i: { name: string; division_id: string | null }) => Promise<Result>;
  updateClient: (i: { id: string; name: string; division_id: string | null }) => Promise<Result>;
  deleteClient: (id: string) => Promise<Result>;
  createRequirement: (i: { division_id: string; client_id: string | null; title: string; job_code: string; positions: number; priority: string; status: string; date_received: string }) => Promise<Result>;
  allocate: (i: { requirement_id: string; recruiter_id: string }) => Promise<Result>;
  updateRequirement: (i: { id: string; title: string; job_code: string; positions: number; priority: string; status: string }) => Promise<Result>;
  deleteRequirement: (id: string) => Promise<Result>;
  removeAllocation: (id: string) => Promise<Result>;
};

const STATUSES = ["open", "on_hold", "closed", "filled", "cancelled"];
const PRIORITIES = [
  { value: "high", label: "High" },
  { value: "med", label: "Medium" },
  { value: "low", label: "Low" },
];
const today = () => new Date().toISOString().slice(0, 10);

// little red required asterisk
function Req() { return <span className="text-danger-600">*</span>; }

export default function RequirementsManager({
  divisions, clients, recruiters, requirements, allocations, actions, fixedDivision, canCreate = true, canDelete = true,
}: { divisions: Div[]; clients: Client[]; recruiters: Recruiter[]; requirements: Req[]; allocations: Alloc[]; actions: Actions; fixedDivision?: Div | null; canCreate?: boolean; canDelete?: boolean }) {
  const [cName, setCName] = useState(""); const [cDiv, setCDiv] = useState(fixedDivision?.id ?? ""); const [cMsg, setCMsg] = useState<string | null>(null);
  const [r, setR] = useState({ division_id: fixedDivision?.id ?? divisions[0]?.id ?? "", client_id: "", title: "", job_code: "", positions: "1", priority: "med", status: "open", date_received: today() });
  const [rMsg, setRMsg] = useState<string | null>(null);
  const divName = (id?: string | null) => divisions.find((d) => d.id === id)?.name ?? "—";

  const reqDivision = fixedDivision?.id ?? r.division_id;
  const reqValid = r.title.trim().length > 0 && !!reqDivision;

  async function addClient() {
    if (!cName.trim()) { setCMsg("Client name is required."); return; }
    const res = await actions.createClientCompany({ name: cName.trim(), division_id: fixedDivision ? fixedDivision.id : (cDiv || null) });
    setCMsg(res.ok ? "Client added." : "Error: " + res.error); if (res.ok) setCName("");
  }
  async function addReq() {
    if (!reqValid) { setRMsg("Title and division are required."); return; }
    const res = await actions.createRequirement({ ...r, division_id: reqDivision, positions: Number(r.positions) } as any);
    setRMsg(res.ok ? "Requirement created." : "Error: " + res.error); if (res.ok) setR({ ...r, title: "", job_code: "", positions: "1" });
  }

  return (
    <div className="space-y-6">
      {fixedDivision && (
        <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm text-brand-700">
          You&apos;re managing the <b>{fixedDivision.name}</b> desk. Allocations can go to any recruiter in that division; requirements are created by admins.
        </div>
      )}

      {canCreate && (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="New requirement">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Title <Req /></Label><Input value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} placeholder="Senior React Engineer" /></div>
            <div className="col-span-2"><Label>Job code</Label><Input value={r.job_code} onChange={(e) => setR({ ...r, job_code: e.target.value })} placeholder="e.g. JD-2045 / REQ-US-118" /></div>
            {!fixedDivision && (
              <div><Label>Division <Req /></Label>
                <select className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm" value={r.division_id} onChange={(e) => setR({ ...r, division_id: e.target.value })}>
                  <option value="">Select…</option>{divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            <div><Label>Client</Label>
              <select className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm" value={r.client_id} onChange={(e) => setR({ ...r, client_id: e.target.value })}>
                <option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><Label>Positions</Label><Input type="number" min={1} value={r.positions} onChange={(e) => setR({ ...r, positions: e.target.value })} /></div>
            <div><Label>Priority</Label>
              <select className={`h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm font-medium ${priorityTextClass(r.priority)}`} value={r.priority} onChange={(e) => setR({ ...r, priority: e.target.value })}>
                <option value="">—</option>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div><Label>Status</Label>
              <select className={`h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm font-medium ${statusTextClass(r.status)}`} value={r.status} onChange={(e) => setR({ ...r, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3"><Button disabled={!reqValid} onClick={addReq}>Create</Button>{rMsg && <span className="text-sm text-muted">{rMsg}</span>}</div>
        </Card>

        <Card title="New client">
          <div className="grid grid-cols-2 gap-3">
            <div className={fixedDivision ? "col-span-2" : ""}><Label>Name <Req /></Label><Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Acme Corp" /></div>
            {!fixedDivision && (
              <div><Label>Division</Label>
                <select className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm" value={cDiv} onChange={(e) => setCDiv(e.target.value)}>
                  <option value="">—</option>{divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3"><Button disabled={!cName.trim()} onClick={addClient}>Add client</Button>{cMsg && <span className="text-sm text-muted">{cMsg}</span>}</div>
        </Card>
      </div>
      )}

      {/* Requirements list (above clients, per spec) */}
      <Card title="Requirements · edit, delete & allocate">
        <div className="space-y-3">
          {requirements.map((req) => (
            <ReqRow key={req.id} req={req} recruiters={recruiters} actions={actions} canDelete={canDelete} divName={divName}
              allocs={allocations.filter((a) => a.requirement_id === req.id)} />
          ))}
          {requirements.length === 0 && <p className="py-6 text-center text-sm text-muted">No requirements yet{canCreate ? " — create one above to start allocating." : "."}</p>}
        </div>
      </Card>

      {/* Clients list (below requirements) */}
      {canCreate && (
        <ClientsList clients={clients} divisions={divisions} actions={actions} />
      )}
    </div>
  );
}

function ClientsList({ clients, divisions, actions }: { clients: Client[]; divisions: Div[]; actions: Actions }) {
  return (
    <Card title="Clients" action={<span className="text-xs text-muted">{clients.length} total</span>}>
      {clients.length === 0 ? (
        <p className="py-2 text-sm text-muted">No clients yet — add one above.</p>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => <ClientRow key={c.id} c={c} divisions={divisions} actions={actions} />)}
        </div>
      )}
    </Card>
  );
}

function ClientRow({ c, divisions, actions }: { c: Client; divisions: Div[]; actions: Actions }) {
  const [name, setName] = useState(c.name);
  const [div, setDiv] = useState(c.division_id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const dirty = name !== c.name || div !== (c.division_id ?? "");

  async function save() {
    if (!name.trim()) { setMsg("Name required"); return; }
    const res = await actions.updateClient({ id: c.id, name, division_id: div || null });
    setMsg(res.ok ? "saved" : res.error!);
  }
  async function del() {
    if (!confirm(`Delete client "${c.name}"? Requirements keep their data but lose this client link.`)) return;
    const res = await actions.deleteClient(c.id);
    if (res.ok) setGone(true); else setMsg(res.error!);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 max-w-xs flex-1" />
      <select className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" value={div} onChange={(e) => setDiv(e.target.value)}>
        <option value="">No division</option>{divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <Button size="sm" variant="secondary" disabled={!dirty || !name.trim()} onClick={save}>Save</Button>
      <Button size="sm" variant="danger" onClick={del}>Delete</Button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}

function ReqRow({ req, recruiters, allocs, actions, canDelete = true, divName }: { req: Req; recruiters: Recruiter[]; allocs: Alloc[]; actions: Actions; canDelete?: boolean; divName: (id?: string | null) => string }) {
  const [v, setV] = useState({ title: req.title, job_code: req.job_code ?? "", positions: req.positions.toString(), priority: req.priority ?? "", status: req.status });
  const [picks, setPicks] = useState<string[]>([]);
  const [openAssign, setOpenAssign] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [localAllocs, setLocalAllocs] = useState(allocs);
  const [busy, setBusy] = useState(false);
  if (gone) return null;

  const assignedIds = new Set(localAllocs.map((a) => a.recruiter_id));
  const available = recruiters.filter((rc) => !assignedIds.has(rc.id));

  // Cross-division eligibility: a recruiter must belong to this requirement's division.
  const reqDiv = req.division_id ?? null;
  const isEligible = (rc: Recruiter) => !reqDiv || (rc.division_ids ?? []).includes(reqDiv);
  const eligible = available.filter(isEligible);
  const ineligible = available.filter((rc) => !isEligible(rc));
  const toggle = (id: string) => setPicks((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  async function save() {
    if (!v.title.trim()) { setMsg("Title required"); return; }
    const res = await actions.updateRequirement({ id: req.id, title: v.title, job_code: v.job_code, positions: Number(v.positions), priority: v.priority, status: v.status });
    setMsg(res.ok ? "saved" : res.error!);
  }
  async function del() { if (!confirm(`Delete requirement "${req.title}"? This removes its allocations too.`)) return; const res = await actions.deleteRequirement(req.id); if (res.ok) setGone(true); else setMsg(res.error!); }
  async function doAlloc() {
    if (picks.length === 0) { setMsg("Tick at least one recruiter."); return; }
    setBusy(true); setMsg(null);
    const newly: typeof localAllocs = [];
    const failed: string[] = [];
    for (const id of picks) {
      const res = await actions.allocate({ requirement_id: req.id, recruiter_id: id });
      const rc = recruiters.find((x) => x.id === id);
      if (res.ok && res.id) newly.push({ id: res.id, requirement_id: req.id, recruiter_id: id, allocation_date: today(), profiles: { full_name: rc?.full_name ?? "recruiter" } });
      else failed.push(rc?.full_name ?? "one recruiter");
    }
    setBusy(false);
    if (newly.length) setLocalAllocs([...localAllocs, ...newly]);
    setPicks([]); setOpenAssign(false);
    if (failed.length) setMsg(`Assigned ${newly.length}. Couldn't assign: ${failed.join(", ")}.`);
  }
  async function unAlloc(id: string) { const res = await actions.removeAllocation(id); if (res.ok) setLocalAllocs(localAllocs.filter((a) => a.id !== id)); }

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-12 md:items-end">
        <div className="md:col-span-3"><Label>Title <Req /></Label><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Job code</Label><Input value={v.job_code} onChange={(e) => setV({ ...v, job_code: e.target.value })} placeholder="—" /></div>
        <div className="md:col-span-2"><Label>Positions</Label><Input type="number" min={1} value={v.positions} onChange={(e) => setV({ ...v, positions: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Priority</Label>
          <select className={`h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm font-medium ${priorityTextClass(v.priority)}`} value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value })}>
            <option value="">—</option>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="md:col-span-2"><Label>Status</Label>
          <select className={`h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm font-medium ${statusTextClass(v.status)}`} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>{["open","on_hold","closed","filled","cancelled"].map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div className="flex gap-2 md:col-span-1">
          <Button size="sm" disabled={!v.title.trim()} onClick={save}>Save</Button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-xs text-muted">
          {req.divisions?.name ?? divName(req.division_id)} · {req.clients?.name ?? "no client"}{req.job_code ? ` · ${req.job_code}` : ""} · received {req.date_received}
        </div>
        {canDelete && <Button size="sm" variant="danger" onClick={del}>Delete</Button>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="text-xs font-semibold uppercase text-muted">Assigned to:</span>
        {localAllocs.length === 0 && <span className="text-xs text-muted">nobody yet</span>}
        {localAllocs.map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
            {a.profiles?.full_name ?? "recruiter"} <button onClick={() => unAlloc(a.id)} title="Remove" className="text-brand-700/60 hover:text-danger-600">×</button>
          </span>
        ))}
        <span className="mx-1 text-line">|</span>
        {recruiters.length === 0 ? (
          <span className="text-xs text-muted">No recruiters found — add them in Admin → People.</span>
        ) : available.length === 0 ? (
          <span className="text-xs text-muted">All recruiters assigned.</span>
        ) : (
          <div className="relative">
            <Button size="sm" variant="secondary" onClick={() => setOpenAssign((o) => !o)}>
              {openAssign ? "Close" : `Assign recruiters${picks.length ? ` (${picks.length})` : ""}`}
            </Button>
            {openAssign && (
              <div className="absolute z-20 mt-1 w-72 rounded-xl border border-line bg-surface p-2 shadow-pop">
                <div className="max-h-56 overflow-auto">
                  {eligible.length > 0 && (
                    <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{reqDiv ? `${divName(reqDiv)} recruiters` : "Recruiters"}</div>
                  )}
                  {eligible.map((rc) => (
                    <label key={rc.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-canvas">
                      <input type="checkbox" className="h-4 w-4 rounded border-line" checked={picks.includes(rc.id)} onChange={() => toggle(rc.id)} />
                      {rc.full_name}
                    </label>
                  ))}
                  {ineligible.length > 0 && (
                    <>
                      <div className="mt-1 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Other divisions — not allowed</div>
                      {ineligible.map((rc) => (
                        <div key={rc.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted/60" title={`Not in ${divName(reqDiv)}`}>
                          <input type="checkbox" disabled className="h-4 w-4 rounded border-line" /> {rc.full_name}
                        </div>
                      ))}
                    </>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-line pt-2">
                  <button className="text-xs text-muted hover:text-ink" onClick={() => setPicks(eligible.map((r) => r.id))}>Select all</button>
                  <Button size="sm" disabled={picks.length === 0 || busy} onClick={doAlloc}>{busy ? "Assigning…" : `Allocate${picks.length ? ` ${picks.length}` : ""}`}</Button>
                </div>
              </div>
            )}
          </div>
        )}
        {msg && <span className="ml-1 text-xs text-muted">{msg}</span>}
      </div>

    </div>
  );
}
