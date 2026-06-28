// Shared (client + server safe) helpers for the AI-team fetched-profile pipeline.

export const FETCHED_STATUSES: { value: string; label: string; color: string; terminal?: boolean }[] = [
  { value: "yet_to_review", label: "Yet to review", color: "#64748b" },
  { value: "connection_sent", label: "Connection sent", color: "#0ea5e9" },
  { value: "connected", label: "Connected", color: "#2563eb" },
  { value: "in_conversation", label: "In conversation", color: "#6366f1" },
  { value: "strong", label: "Strong profile", color: "#16a34a" },
  { value: "junior", label: "Junior profile", color: "#a855f7" },
  { value: "overqualified", label: "Overqualified", color: "#9333ea" },
  { value: "beyond_budget", label: "Beyond budget", color: "#e11d48" },
  { value: "not_ready_relocate", label: "Not ready to relocate", color: "#f97316" },
  { value: "notice_30", label: "Notice period 30 days", color: "#0d9488" },
  { value: "notice_60", label: "Notice period 60 days", color: "#0891b2" },
  { value: "notice_90", label: "Notice period 90 days", color: "#6b7280" },
  { value: "tech_scheduled", label: "Technical scheduled", color: "#d97706" },
  { value: "tech_conducted", label: "Technical conducted", color: "#b45309" },
  { value: "not_a_fit", label: "Not a fit", color: "#dc2626", terminal: true },
  { value: "rejected_tech", label: "Rejected in technical", color: "#b91c1c", terminal: true },
  { value: "internal_submission", label: "Internal submission", color: "#2563eb" },
  { value: "client_submission", label: "Client submission", color: "#15803d" },
  { value: "closure", label: "Closure", color: "#ca8a04", terminal: true },
];

export const statusLabel = (v: string) => FETCHED_STATUSES.find((s) => s.value === v)?.label ?? v;
export const statusColor = (v: string) => FETCHED_STATUSES.find((s) => s.value === v)?.color ?? "#64748b";
export const isValidStatus = (v: string) => FETCHED_STATUSES.some((s) => s.value === v);

// Milestones notify the AI team instantly (+ email); everything else is batched into a digest.
export const MILESTONE_STATUSES = new Set(["internal_submission", "client_submission", "closure"]);
export const isMilestoneStatus = (v: string) => MILESTONE_STATUSES.has(v);

// Map a free-text CSV status onto a known value; default to "connected".
export function normalizeStatus(raw: string | undefined): string {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return "connected";
  const byValue = FETCHED_STATUSES.find((s) => s.value === t);
  if (byValue) return byValue.value;
  const byLabel = FETCHED_STATUSES.find((s) => s.label.toLowerCase() === t);
  if (byLabel) return byLabel.value;
  if (t.includes("not") && t.includes("fit")) return "not_a_fit";
  if (t.includes("junior")) return "junior";
  if (t.includes("strong")) return "strong";
  if (t.includes("convers")) return "in_conversation";
  if (t.includes("connect")) return "connected";
  if (t.includes("schedul")) return "tech_scheduled";
  if (t.includes("conduct")) return "tech_conducted";
  if (t.includes("reject")) return "rejected_tech";
  if (t.includes("internal")) return "internal_submission";
  if (t.includes("client")) return "client_submission";
  if (t.includes("clos")) return "closure";
  return "connected";
}

export function parseBool(raw: string | undefined): boolean | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return null;
  return ["yes", "y", "true", "1", "open", "open2work", "opentowork", "available"].includes(t);
}

// Turn a share URL into a directly-fetchable URL:
//  • Google Sheets  → CSV-export URL
//  • SharePoint / OneDrive → direct download (works for "anyone with the link" shares;
//    the downloaded .xlsx/.csv is parsed server-side)
//  • anything else  → passed through (e.g. a direct CSV link)
export function toCsvUrl(link: string): string {
  const l = link.trim();
  const g = l.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (g) {
    const gid = (l.match(/[#&?]gid=(\d+)/) || [])[1] ?? "0";
    return `https://docs.google.com/spreadsheets/d/${g[1]}/export?format=csv&gid=${gid}`;
  }
  if (/sharepoint\.com|onedrive\.live\.com|1drv\.ms/i.test(l) && !/[?&]download=1(?:&|$)/.test(l)) {
    return l + (l.includes("?") ? "&" : "?") + "download=1";
  }
  return l;
}

// True for hosts that serve Excel workbooks (so we parse .xlsx rather than CSV text).
export function isSharePointLink(link: string): boolean {
  return /sharepoint\.com|onedrive\.live\.com|1drv\.ms/i.test(link);
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields, embedded commas/newlines).
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (ch !== "\r") field += ch;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => { const o: Record<string, string> = {}; headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim())); return o; });
}

// Pull a value from a parsed row by trying several header aliases (substring match).
function field(row: Record<string, string>, ...aliases: string[]): string {
  const keys = Object.keys(row);
  for (const a of aliases) {
    const hit = keys.find((k) => k === a) ?? keys.find((k) => k.includes(a));
    if (hit && row[hit]) return row[hit];
  }
  return "";
}

export type FetchedRow = {
  candidate_name: string | null; linkedin_url: string | null; location: string | null;
  email: string | null; phone: string | null; open_to_work: boolean | null;
  ownership: string | null; status: string;
};

export function rowToFetched(row: Record<string, string>): FetchedRow {
  return {
    candidate_name: field(row, "name", "candidate") || null,
    linkedin_url: field(row, "linkedin", "linked in", "profile url") || null,
    location: field(row, "location", "city") || null,
    email: field(row, "email", "e-mail") || null,
    phone: field(row, "phone", "mobile", "contact") || null,
    open_to_work: parseBool(field(row, "open2work", "open to work", "opentowork", "open")),
    ownership: field(row, "ownership", "owner") || null,
    status: normalizeStatus(field(row, "status")),
  };
}
