import { Card } from "@/components/ui";

type Winner = { period_type: string; name: string; closures: number; period_end: string } | null;

export default function PerformerCards({ week, month, year }: { week: Winner; month: Winner; year: Winner }) {
  const Item = ({ label, w }: { label: string; w: Winner }) => (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">Performer of the {label}</div>
      {w ? (
        <>
          <div className="mt-1 text-lg font-bold">{w.name}</div>
          <div className="text-xs text-slate-500">{w.closures} closures · ended {w.period_end}</div>
        </>
      ) : (
        <div className="mt-1 text-sm text-slate-400">No finalized {label} yet</div>
      )}
    </Card>
  );
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Item label="week" w={week} />
      <Item label="month" w={month} />
      <Item label="year" w={year} />
    </div>
  );
}
