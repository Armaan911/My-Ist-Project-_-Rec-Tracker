// Parse a recruiter's email reply into daily-activity numbers.
// Tolerant of formats like:
//   "Resumes: 12, Parsed: 30, Worked on: Acme backend role"
//   "12 resumes sourced\n30 applicants parsed\nNotes: chased 2 offers"
//   "resumes sourced - 12 ; parsed 30"

export type ParsedDaily = {
  resumes_sourced: number | null;
  applicants_parsed: number | null;
  notes: string;
};

// Strip HTML to text, then drop quoted reply history.
export function htmlToText(input: string): string {
  let t = input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');
  // collapse excessive blank lines
  t = t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

// Remove the quoted original message from a reply.
export function stripQuotedHistory(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const l = line.trim();
    // common reply boundaries
    if (/^[-]{2,}\s*original message\s*[-]{2,}/i.test(l)) break;
    if (/^on .+ wrote:$/i.test(l)) break;
    if (/^from:\s/i.test(l) && out.length > 0) break;
    if (/^_{5,}$/.test(l)) break;
    if (l.startsWith(">")) continue; // quoted line
    out.push(line);
  }
  return out.join("\n").trim();
}

function firstNumberNear(text: string, keywords: string[]): number | null {
  for (const kw of keywords) {
    // keyword followed by separators then a number  (e.g. "resumes: 12", "resumes - 12")
    let m = new RegExp(`${kw}[^0-9\\n]{0,15}?(\\d{1,5})`, "i").exec(text);
    if (m) return parseInt(m[1], 10);
    // number followed by keyword  (e.g. "12 resumes")
    m = new RegExp(`(\\d{1,5})[^0-9\\n]{0,15}?${kw}`, "i").exec(text);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

export function parseDailyReply(rawBody: string, isHtml: boolean): ParsedDaily {
  const text = stripQuotedHistory(isHtml ? htmlToText(rawBody) : rawBody);

  const resumes = firstNumberNear(text, ["resumes? sourced", "resumes?", "sourced", "cv'?s?"]);
  const parsed = firstNumberNear(text, ["applicants? parsed", "parsed", "applicants?", "screened"]);

  // notes: prefer an explicit "worked on" / "notes" line, else the cleaned reply text.
  let notes = "";
  const noteLine = /(?:worked on|notes?|comments?)[:\-]\s*(.+)/i.exec(text);
  if (noteLine) notes = noteLine[1].trim();
  else notes = text.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 4).join(" ").slice(0, 500);

  return { resumes_sourced: resumes, applicants_parsed: parsed, notes };
}
