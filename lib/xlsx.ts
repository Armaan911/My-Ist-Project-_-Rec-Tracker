import ExcelJS from "exceljs";

// exceljs cell values can be plain scalars or objects (hyperlinks, rich text, formulas).
function cellText(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (typeof v.text === "string") return v.text;                                  // hyperlink cell
    if (Array.isArray(v.richText)) return v.richText.map((t: any) => t?.text ?? "").join("");
    if ("result" in v) return cellText(v.result);                                   // formula → result
    if (typeof v.hyperlink === "string") return v.hyperlink;
  }
  return String(v);
}

// Read the first worksheet of an .xlsx workbook into the same shape parseCsv produces
// (header row → lowercased keys), so the rest of the import pipeline is unchanged.
export async function xlsxToRows(buf: ArrayBuffer): Promise<Record<string, string>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(buf) as any);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const matrix: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = row.values as any[]; // 1-indexed: [empty, col1, col2, …]
    const cells: string[] = [];
    for (let c = 1; c < vals.length; c++) cells.push(cellText(vals[c]).trim());
    matrix.push(cells);
  });
  if (matrix.length === 0) return [];
  const headers = matrix[0].map((h) => h.trim().toLowerCase());
  return matrix.slice(1)
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => { const o: Record<string, string> = {}; headers.forEach((h, i) => (o[h] = r[i] ?? "")); return o; });
}
