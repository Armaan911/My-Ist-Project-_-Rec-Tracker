// Lightweight, on-brand inline SVG illustrations for empty states.
// No external images — they render instantly and inherit the brand palette.

const BRAND = "#068AD3";
const SOFT = "#E0E0FA";

function Frame({ children }: { children: React.ReactNode }) {
  return <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">{children}</svg>;
}

export function EmptyPipeline() {
  return (
    <Frame>
      <circle cx="60" cy="60" r="56" fill={SOFT} opacity="0.4" />
      <rect x="30" y="40" width="60" height="12" rx="6" fill={SOFT} />
      <rect x="30" y="58" width="44" height="12" rx="6" fill={SOFT} />
      <rect x="30" y="76" width="30" height="12" rx="6" fill={BRAND} opacity="0.6" />
      <circle cx="92" cy="38" r="12" fill={BRAND} />
      <path d="M87 38l3.5 3.5L97 35" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function EmptyInbox() {
  return (
    <Frame>
      <circle cx="60" cy="60" r="56" fill={SOFT} opacity="0.4" />
      <path d="M34 50l26-14 26 14v28a4 4 0 01-4 4H38a4 4 0 01-4-4V50z" fill="#fff" stroke={BRAND} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M34 50l26 16 26-16" stroke={BRAND} strokeWidth="2.4" strokeLinejoin="round" fill="none" />
      <circle cx="60" cy="40" r="4" fill={BRAND} />
    </Frame>
  );
}

export function EmptyPeople() {
  return (
    <Frame>
      <circle cx="60" cy="60" r="56" fill={SOFT} opacity="0.4" />
      <circle cx="48" cy="50" r="12" fill={BRAND} opacity="0.85" />
      <circle cx="76" cy="54" r="10" fill={SOFT} />
      <path d="M30 86c0-11 8-18 18-18s18 7 18 18" stroke={BRAND} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M64 86c1-8 7-13 14-13s13 5 14 12" stroke={SOFT} strokeWidth="6" strokeLinecap="round" fill="none" />
    </Frame>
  );
}

export function AllDone() {
  return (
    <Frame>
      <circle cx="60" cy="60" r="56" fill={SOFT} opacity="0.4" />
      <circle cx="60" cy="60" r="30" fill={BRAND} />
      <path d="M48 60l8 8 16-18" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function EmptyState({
  illustration = "pipeline", title, hint,
}: { illustration?: "pipeline" | "inbox" | "people" | "done"; title: string; hint?: string }) {
  const Art = illustration === "inbox" ? EmptyInbox : illustration === "people" ? EmptyPeople : illustration === "done" ? AllDone : EmptyPipeline;
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      <Art />
      <p className="mt-3 font-medium text-ink">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{hint}</p>}
    </div>
  );
}
