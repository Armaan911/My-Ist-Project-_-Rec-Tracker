import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("action, entity_type, detail, created_at, profiles(full_name)")
    .order("created_at", { ascending: false }).limit(100);

  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold">Audit log (last 100)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">When</th><th>Who</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
          <tbody>
            {(data ?? []).map((r: any, i: number) => (
              <tr key={i} className="border-t border-slate-100 align-top">
                <td className="py-2 whitespace-nowrap text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                <td className="whitespace-nowrap">{r.profiles?.full_name ?? "—"}</td>
                <td className="whitespace-nowrap font-medium">{r.action}</td>
                <td className="whitespace-nowrap text-slate-500">{r.entity_type}</td>
                <td className="font-mono text-xs text-slate-500">{r.detail ? JSON.stringify(r.detail) : "—"}</td>
              </tr>
            ))}
            {(!data || data.length === 0) && <tr><td colSpan={5} className="py-4 text-slate-400">No activity logged yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
