import React, { useMemo, useState } from "react";
import { ArrowUpDown, FileSpreadsheet, Search } from "lucide-react";
import * as XLSX from "xlsx";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import { cn } from "@/lib/utils";

export type DetailColumn<T> = {
  key: string;
  label: string;
  align?: "left" | "right";
  /** Conteúdo renderizado na célula. */
  render: (row: T) => React.ReactNode;
  /** Valor usado na ordenação. Sem isso a coluna não é ordenável. */
  sortValue?: (row: T) => string | number;
  /** Valor levado para o XLSX. Cai no sortValue quando ausente. */
  exportValue?: (row: T) => string | number | null;
};

type ClientDetailsDialogProps<T> = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  columns: DetailColumn<T>[];
  rows: T[];
  isLoading?: boolean;
  /** Texto livre pesquisável de cada linha. */
  searchValue?: (row: T) => string;
  /** Quando informado, o rodapé soma esse valor das linhas visíveis. */
  sumValue?: (row: T) => number;
  sumLabel?: string;
  emptyMessage?: string;
  xlsxName: string;
  maxWidthClass?: string;
  /** Dispara quando o modal abre/fecha — use para só buscar na abertura. */
  onOpenChange?: (open: boolean) => void;
};

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export function ClientDetailsDialog<T>({
  children,
  title,
  subtitle,
  icon: Icon,
  columns,
  rows,
  isLoading = false,
  searchValue,
  sumValue,
  sumLabel = "Total",
  emptyMessage = "Nenhum registro encontrado",
  xlsxName,
  maxWidthClass = "max-w-5xl",
  onOpenChange,
}: ClientDetailsDialogProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const handleSort = (column: DetailColumn<T>) => {
    if (!column.sortValue) return;
    setSortConfig((prev) =>
      prev?.key === column.key && prev.direction === "asc"
        ? { key: column.key, direction: "desc" }
        : { key: column.key, direction: "asc" },
    );
  };

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    let result = rows;

    if (term && searchValue) {
      result = result.filter((row) => searchValue(row).toLowerCase().includes(term));
    }

    if (sortConfig) {
      const column = columns.find((item) => item.key === sortConfig.key);
      if (column?.sortValue) {
        const factor = sortConfig.direction === "asc" ? 1 : -1;
        result = [...result].sort((a, b) => {
          const valueA = column.sortValue!(a);
          const valueB = column.sortValue!(b);
          if (typeof valueA === "number" && typeof valueB === "number") {
            return (valueA - valueB) * factor;
          }
          return String(valueA).localeCompare(String(valueB), "pt-BR") * factor;
        });
      }
    }

    return result;
  }, [rows, search, searchValue, sortConfig, columns]);

  const total = useMemo(() => {
    if (!sumValue) return null;
    return visibleRows.reduce((acc, row) => acc + (sumValue(row) || 0), 0);
  }, [visibleRows, sumValue]);

  const downloadXLSX = () => {
    const data = visibleRows.map((row) => {
      const entry: Record<string, string | number | null> = {};
      for (const column of columns) {
        const value = column.exportValue?.(row) ?? column.sortValue?.(row) ?? null;
        entry[column.label] = value;
      }
      return entry;
    });

    const worksheet = XLSX.utils.json_to_sheet(data.length ? data : [{}]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detalhamento");
    XLSX.writeFile(workbook, `${xlsxName}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className={cn(
          "bg-[#0a0e14] border-white/10 text-[#E8E8E0] p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]",
          maxWidthClass,
        )}
      >
        <DialogHeader className="p-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-euro-gold/20 flex items-center justify-center border border-euro-gold/40 shrink-0">
              <Icon className="w-5 h-5 text-euro-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl sm:text-2xl font-display text-euro-gold tracking-tight text-left">
                {title}
              </DialogTitle>
              {subtitle && <p className="font-data text-[11px] text-white/40 mt-1 text-left">{subtitle}</p>}
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3 text-white/70 hover:text-white hover:bg-white/5 shrink-0"
              onClick={downloadXLSX}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              XLSX
            </Button>
          </div>

          {searchValue && (
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente ou assessor..."
                className="pl-9 h-9 bg-black/30 border-white/10 text-white font-data text-xs placeholder:text-white/25"
              />
            </div>
          )}
        </DialogHeader>

        <div className="p-6 pt-4">
          <div className="bg-euro-card/40 border border-white/10 rounded-xl overflow-hidden relative">
            {isLoading && <LoadingOverlay isLoading={true} />}
            <div className="max-h-[52vh] overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest">
                    {columns.map((column, index) => (
                      <th
                        key={column.key}
                        onClick={() => handleSort(column)}
                        className={cn(
                          "py-3 px-4 font-bold bg-euro-gold",
                          index < columns.length - 1 && "border-r border-euro-navy/10",
                          column.align === "right" && "text-right",
                          column.sortValue && "cursor-pointer hover:bg-euro-navy/5 transition-colors",
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            column.align === "right" && "justify-end",
                          )}
                        >
                          {column.label}
                          {column.sortValue && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {visibleRows.length > 0 ? (
                    visibleRows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="even:bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-[12.5px] font-data"
                      >
                        {columns.map((column, index) => (
                          <td
                            key={column.key}
                            className={cn(
                              "py-2.5 px-4 text-white/85",
                              index < columns.length - 1 && "border-r border-white/5",
                              column.align === "right" && "text-right font-mono",
                            )}
                          >
                            {column.render(row)}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columns.length} className="py-16 text-center opacity-20">
                        <div className="flex flex-col items-center gap-3">
                          <Search className="w-9 h-9" />
                          <p className="text-sm font-data uppercase tracking-widest">{emptyMessage}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 font-data text-xs">
            <span className="text-white/40">
              {visibleRows.length.toLocaleString("pt-BR")}{" "}
              {visibleRows.length === 1 ? "registro" : "registros"}
            </span>
            {total !== null && (
              <span className="text-white/60">
                {sumLabel}:{" "}
                <span className="font-display text-sm text-euro-gold ml-1">{currency(total)}</span>
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
