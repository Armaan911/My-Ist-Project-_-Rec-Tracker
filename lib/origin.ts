import { headers } from "next/headers";

// The canonical production URL. Reset/verification links must always land here (never a
// localhost dev link), so it's the last-resort default even when running locally.
const PROD_URL = "https://my-ist-project-rec-tracker.vercel.app";

// Public origin for links we put in emails. Prefer the ACTUAL request host so links are
// generated dynamically for whichever domain the request came in on (e.g. podium.conglomerate…
// or the *.vercel.app alias). Fall back to NEXT_PUBLIC_APP_URL, then the production URL, for
// contexts with no request host (crons). A link in an email is therefore never localhost.
export function appOrigin(): string {
  const host = (headers().get("host") || "").trim();
  if (host && !host.includes("localhost") && !host.startsWith("127.")) return `https://${host}`;
  const env = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (env && !env.includes("localhost") && !env.includes("127.0.0.1")) return env;
  return PROD_URL;
}
