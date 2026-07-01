import { headers } from "next/headers";

// The canonical production URL. Reset/verification links must always land here (never a
// localhost dev link), so it's the last-resort default even when running locally.
const PROD_URL = "https://my-ist-project-rec-tracker.vercel.app";

// Public origin for links we put in emails. Prefer an explicit NEXT_PUBLIC_APP_URL, then the
// real (non-localhost) request host, and finally the production URL — so a link in an email
// is never localhost.
export function appOrigin(): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (env && !env.includes("localhost") && !env.includes("127.0.0.1")) return env;
  const host = (headers().get("host") || "").trim();
  if (host && !host.includes("localhost") && !host.startsWith("127.")) return `https://${host}`;
  return PROD_URL;
}
