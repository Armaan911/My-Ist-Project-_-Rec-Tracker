import { Card } from "@/components/ui";
import { StatCard } from "@/components/uikit";
import { Clock, CheckCircle2, BadgeIndianRupee, XCircle } from "lucide-react";

type Agg = { name: string; INR: number; USD: number; count: number };
type Props = {
  counts: { pending: number; approved: number; paid: number; declined: number };
  totalsAll: { INR: number; USD: number };
  totalsMonth: { INR: number; USD: number };
  byDivision: Agg[];
  byRecruiter: Agg[];
  monthLabel: string;
};

function inr(n: number) { return `₹${n.toLocaleString("en-IN")}`; }
function usd(n: number) { return `$${n.toLocaleString("en-US")}`; }

// Compact "₹x · $y" pair, hiding a zero side unless both are zero.
function pair(t: { INR: number; USD: number }) {
  const parts: string[] = [];
  if (t.INR) parts.push(inr(t.INR));
  if (t.USD) parts.push(usd(t.USD));
  return parts.length ? parts.join(" · ") : "—";
}

export default function IncentiveAnalytics({ counts, totalsAll, totalsMonth, byDivision, byRecruiter, monthLabel }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Incentive analytics</h1>
        <p className="text-sm text-muted">Approved-incentive spend and the state of the pipeline. INR and USD are tracked separately.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<BadgeIndianRupee size={16} />} label={`Approved · ${monthLabel}`} value={pair(totalsMonth)} hint="Incentives HR approved this month" />
        <StatCard icon={<CheckCircle2 size={16} />} label="Approved · all time" value={pair(totalsAll)} hint={`${counts.approved + counts.paid} incentives`} />
        <StatCard icon={<Clock size={16} />} label="Awaiting HR" value={counts.pending} hint="On the My Plate queue" />
        <StatCard icon={<XCircle size={16} />} label="Declined" value={counts.declined} hint="Requests HR turned down" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="By division">
          <Breakdown rows={byDivision} empty="No approved incentives yet." />
        </Card>
        <Card title="Top recruiters">
          <Breakdown rows={byRecruiter} empty="No approved incentives yet." />
        </Card>
      </div>
    </div>
  );
}

function Breakdown({ rows, empty }: { rows: Agg[]; empty: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.INR + r.USD), 1);
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium">{r.name}</span>
            <span className="shrink-0 text-muted">{pair(r)} <span className="text-xs">· {r.count}</span></span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round(((r.INR + r.USD) / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
