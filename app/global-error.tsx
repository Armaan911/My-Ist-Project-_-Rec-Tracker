"use client";

// Top-level error boundary — replaces the whole document if even the root layout throws.
// Uses inline styles only (globals.css may not be available here) so it always renders
// something visible instead of a blank screen.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif", margin: 0, padding: "2rem", color: "#1e293b", background: "#f6f6f8" }}>
        <div style={{ maxWidth: 560, margin: "10vh auto 0" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#64748b" }}>The app hit an unexpected error. Reloading usually fixes it.</p>
          {(error?.message || error?.digest) && (
            <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, color: "#b91c1c", background: "#fef2f2", padding: 12, borderRadius: 8 }}>
              {error?.message}{error?.digest ? `\n(ref: ${error.digest})` : ""}
            </pre>
          )}
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button onClick={() => reset()} style={{ background: "#5b5bd6", color: "#fff", border: 0, borderRadius: 8, padding: "8px 16px", fontSize: 14, fontWeight: 600 }}>Try again</button>
            <button onClick={() => location.reload()} style={{ background: "#fff", color: "#1e293b", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", fontSize: 14, fontWeight: 600 }}>Reload</button>
          </div>
        </div>
      </body>
    </html>
  );
}
