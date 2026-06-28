"use client";

// Route-segment error boundary — catches a throw inside a page (within the layout chrome)
// and shows a readable error + recovery, instead of unmounting the tree to a blank screen.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-[10vh] max-w-xl px-6">
      <h1 className="text-xl font-bold text-ink">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">This screen hit an error. Try again, or reload the app.</p>
      {(error?.message || error?.digest) && (
        <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-danger-50 p-3 text-xs text-danger-600">
          {error?.message}{error?.digest ? `\n(ref: ${error.digest})` : ""}
        </pre>
      )}
      <div className="mt-4 flex gap-2">
        <button onClick={() => reset()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Try again</button>
        <button onClick={() => location.reload()} className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink">Reload</button>
      </div>
    </div>
  );
}
