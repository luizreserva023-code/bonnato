export type ExportColumn<T> = {
  key: string;
  label: string;
  value: (row: T) => unknown;
};

function sanitizeFilename(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9À-ÿ_-]+/g, "-").replace(/^-+|-+$/g, "") || "exportacao";
}

function normalizeCell(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toLocaleString("pt-BR");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportCsv<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const escape = (value: unknown) => `"${normalizeCell(value).replace(/"/g, '""')}"`;
  const content = [
    columns.map((column) => escape(column.label)).join(";"),
    ...rows.map((row) => columns.map((column) => escape(column.value(row))).join(";")),
  ].join("\r\n");
  downloadBlob(new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" }), `${sanitizeFilename(filename)}.csv`);
}

export async function exportXlsx<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const XLSX = await import("xlsx");
  const data = rows.map((row) => Object.fromEntries(columns.map((column) => [column.label, normalizeCell(column.value(row))])));
  const sheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Dados");
  XLSX.writeFile(workbook, `${sanitizeFilename(filename)}.xlsx`);
}

export async function exportPdf<T>(rows: T[], columns: ExportColumn<T>[], filename: string, title = filename) {
  const { jsPDF } = await import("jspdf");
  const document = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const margin = 36;
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const columnWidth = (pageWidth - margin * 2) / Math.max(1, columns.length);
  let y = 42;

  document.setFontSize(15);
  document.text(title, margin, y);
  y += 24;
  document.setFontSize(8);
  document.setFont("helvetica", "bold");
  columns.forEach((column, index) => document.text(column.label.slice(0, 28), margin + index * columnWidth, y, { maxWidth: columnWidth - 5 }));
  y += 14;
  document.setFont("helvetica", "normal");

  for (const row of rows) {
    const cells = columns.map((column) => normalizeCell(column.value(row)));
    const lineHeight = Math.max(12, ...cells.map((cell) => document.splitTextToSize(cell, columnWidth - 5).length * 9));
    if (y + lineHeight > pageHeight - margin) {
      document.addPage();
      y = margin;
    }
    cells.forEach((cell, index) => {
      document.text(document.splitTextToSize(cell, columnWidth - 5), margin + index * columnWidth, y, { maxWidth: columnWidth - 5 });
    });
    y += lineHeight;
  }

  document.save(`${sanitizeFilename(filename)}.pdf`);
}

export async function exportRows<T>(
  format: "csv" | "xlsx" | "pdf",
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  title?: string,
) {
  if (format === "csv") return exportCsv(rows, columns, filename);
  if (format === "xlsx") return exportXlsx(rows, columns, filename);
  return exportPdf(rows, columns, filename, title);
}
