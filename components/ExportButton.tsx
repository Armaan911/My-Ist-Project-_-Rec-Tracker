"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/uikit";
import { buildPerformanceCsv } from "@/app/manager/export-actions";

// Builds the performance CSV on the server, downloads it in the browser.
export default function ExportButton({ month, divisionId, period, label = "Export CSV" }: { month?: string; divisionId?: string | null; period?: "today" | "week" | "month"; label?: string }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const res = await buildPerformanceCsv({ month, divisionId, period });
      if (!res.ok) { toast(res.error || "Export failed", "error"); return; }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast("Performance CSV downloaded", "success");
    } catch {
      toast("Export failed", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="secondary" size="sm" onClick={run} loading={busy}>
      <Download size={14} /> {label}
    </Button>
  );
}
