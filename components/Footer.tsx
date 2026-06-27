import Link from "next/link";

// App footer — brand mark, tagline, a live status pill, and copyright, under a quiet
// gradient accent. Rendered once globally from the root layout.
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="safe-x mt-14 border-t border-line bg-surface/70">
      <div className="h-[3px] w-full brand-mark opacity-80" />
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 pt-8 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
          <img src="/logo-static.png" alt="Podium" className="h-10 w-auto object-contain" />
          <span className="hidden h-9 w-px bg-line sm:block" />
          <p className="max-w-sm text-center text-sm text-muted sm:text-left">
            Daily allocation, pipeline &amp; performance — built for Conglomerate Corporates.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 sm:items-end">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success-600/30 bg-success-50 px-3 py-1 text-xs font-medium text-success-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-600" /> All systems operational
          </span>
          <p className="text-xs text-muted">
            © {year} Conglomerate Corporates · Podium ·{" "}
            <Link href="/security" className="transition-colors hover:text-ink">Security</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
