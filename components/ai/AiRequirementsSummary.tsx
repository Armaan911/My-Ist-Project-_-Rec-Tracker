"use client";
import { Card } from "@/components/ui";
import { usePaged, Pager } from "@/components/Pager";

type Row = { title: string; division: string; count: number };

export default function AiRequirementsSummary({ rows }: { rows: Row[] }) {
  const pg = usePaged(rows, 20);
  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Requirements you’ve sourced for</h2>
      <p className="mb-3 text-sm text-muted">Job roles you’ve worked on, their division, and how many profiles you sourced.</p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No sourcing yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr><th className="py-2 pr-3 font-medium">Job role</th><th className="pr-3 font-medium">Division</th><th className="text-right font-medium">Sourced profiles</th></tr>
              </thead>
              <tbody>
                {pg.slice.map((r, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="py-2 pr-3 font-medium">{r.title}</td>
                    <td className="pr-3 text-muted">{r.division}</td>
                    <td className="text-right font-semibold">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={pg.page} pageCount={pg.pageCount} setPage={pg.setPage} total={pg.total} pageSize={pg.pageSize} />
        </>
      )}
    </Card>
  );
}
