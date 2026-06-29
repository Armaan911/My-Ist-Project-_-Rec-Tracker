"use client";
import { useState } from "react";
import { markAlertRead } from "@/app/manager/actions";
import { Card } from "@/components/ui";

type Alert = { id: string; type: string; severity: string; title: string; body: string | null; is_read: boolean; created_at: string };

export default function AlertsFeed({ alerts }: { alerts: Alert[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = alerts.filter((a) => !hidden.has(a.id));

  async function dismiss(id: string) {
    setHidden((s) => new Set(s).add(id));
    await markAlertRead(id);
  }
  async function clearAll() {
    const ids = visible.map((a) => a.id);
    const unread = visible.filter((a) => !a.is_read).map((a) => a.id);
    setHidden((s) => { const n = new Set(s); ids.forEach((id) => n.add(id)); return n; });
    await Promise.all(unread.map((id) => markAlertRead(id)));
  }

  const color = (sev: string) =>
    sev === "critical" ? "border-red-300 bg-red-50" : sev === "warning" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50";

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Alerts</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{visible.filter((a) => !a.is_read).length} unread</span>
          {visible.length > 0 && <button onClick={clearAll} className="text-xs font-medium text-brand-700 underline hover:text-brand-800">Clear all</button>}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="py-2 text-sm text-muted">All clear — no flags right now.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((a) => (
            <li key={a.id} className={`rounded-lg border px-3 py-2 ${color(a.severity)} ${a.is_read ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  {a.body && <p className="text-xs text-slate-600">{a.body}</p>}
                </div>
                {!a.is_read && (
                  <button onClick={() => dismiss(a.id)} className="shrink-0 text-xs text-slate-500 underline">mark read</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
