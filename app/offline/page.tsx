export const metadata = { title: "Offline — Recruit Tracker" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 text-center">
      <div className="max-w-sm">
        <img src="/icons/icon-192.png" alt="" className="mx-auto h-16 w-16 rounded-2xl shadow-card" />
        <h1 className="mt-5 font-display text-xl font-bold tracking-tight">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-muted">
          Recruit Tracker needs a connection to load fresh data. Check your network — anything you&apos;ve already opened still works, and your place is saved.
        </p>
        <a href="/dashboard" className="mt-5 inline-flex h-10 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700">
          Try again
        </a>
      </div>
    </main>
  );
}
