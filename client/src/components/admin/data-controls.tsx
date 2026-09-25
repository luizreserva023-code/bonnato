import { ArrowDown, ArrowUp, Columns3, Download, FileSpreadsheet, FileText, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportRows, type ExportColumn } from "@/lib/export-utils";
import type { TableColumnPreference } from "@/hooks/use-table-preferences";

export function AdminExportMenu<T>({
  rows,
  columns,
  filename,
  title,
  disabled,
}: {
  rows: T[];
  columns: ExportColumn<T>[];
  filename: string;
  title?: string;
  disabled?: boolean;
}) {
  async function run(format: "csv" | "xlsx" | "pdf") {
    if (!rows.length) {
      toast.info("Não há dados para exportar com os filtros atuais.");
      return;
    }
    const id = toast.loading("Preparando exportação...");
    try {
      await exportRows(format, rows, columns, filename, title);
      toast.success("Exportação concluída.", { id });
    } catch (error) {
      console.error("[export]", error);
      toast.error("Não foi possível gerar a exportação.", { id });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled} className="gap-2">
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Exportar dados filtrados</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => void run("csv")}><FileText className="h-4 w-4" /> CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run("xlsx")}><FileSpreadsheet className="h-4 w-4" /> XLSX</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run("pdf")}><FileText className="h-4 w-4" /> PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminTableColumnsMenu({
  columns,
  hidden,
  onToggle,
  onMove,
  onReset,
}: {
  columns: readonly TableColumnPreference[];
  hidden: readonly string[];
  onToggle: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onReset: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <Columns3 className="h-4 w-4" /> Colunas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Personalizar tabela</DropdownMenuLabel>
        {columns.map((column, index) => (
          <div key={column.id} className="flex items-center">
            <DropdownMenuCheckboxItem
              className="flex-1"
              checked={!hidden.includes(column.id)}
              disabled={column.hideable === false}
              onCheckedChange={() => onToggle(column.id)}
              onSelect={(event) => event.preventDefault()}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={index === 0}
              aria-label={`Mover ${column.label} para a esquerda`}
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); onMove(column.id, -1); }}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mr-1 h-7 w-7"
              disabled={index === columns.length - 1}
              aria-label={`Mover ${column.label} para a direita`}
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); onMove(column.id, 1); }}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onReset}><RotateCcw className="h-4 w-4" /> Restaurar padrão</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
