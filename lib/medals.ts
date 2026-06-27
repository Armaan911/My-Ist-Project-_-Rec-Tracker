export type Tier = { name: string; min_closures: number; color: string | null; rank: number };

// Highest tier whose threshold is met by all-time closures, or null.
export function medalFor(closuresAllTime: number, tiers: Tier[]): Tier | null {
  let best: Tier | null = null;
  for (const t of [...tiers].sort((a, b) => a.min_closures - b.min_closures)) {
    if (closuresAllTime >= t.min_closures) best = t;
  }
  return best;
}
