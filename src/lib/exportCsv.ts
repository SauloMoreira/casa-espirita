export function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const bom = "\uFEFF";
  const csvContent =
    bom +
    [headers.join(";"), ...rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))].join(
      "\n"
    );
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}