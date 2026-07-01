import { headers } from "next/headers";

// Public origin for links we put in emails. Prefer the actual request host so a deployed
// site never emits localhost links even if NEXT_PUBLIC_APP_URL is misconfigured; fall back
// to NEXT_PUBLIC_APP_URL (e.g. for cron with no request host).
export function appOrigin(): string {
  const host = (headers().get("host") || "").trim();
  if (host && !host.includes("localhost") && !host.startsWith("127.")) return `https://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL || (host ? `http://${host}` : "");
}
