// A candidate LinkedIn URL must start with https and be on the linkedin.com domain
// (linkedin.com itself or a subdomain like www.linkedin.com / in.linkedin.com).
export function isValidLinkedInUrl(url: string): boolean {
  const u = (url || "").trim();
  if (!/^https:\/\//i.test(u)) return false;
  try {
    const host = new URL(u).hostname.toLowerCase();
    return host === "linkedin.com" || host.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}
