import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { FileSpreadsheet, MessageSquare, AlertTriangle, CheckCircle2, Search, Users, ArrowUpDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

// ===========================================================================
// Tipos
// ===========================================================================

export interface RelacionamentoRow {
  cliente: string;
  tipo_pessoa: string | null;
  net_em_m: number | null;
  data_posicao: string;
  nome_assessor: string | null;
  cod_assessor: string | null;
  id_atividade: string | null;
  tipo: string | null;
  pipe: string | null;
  data_esforco: string | null;
  tipo_esforco: string | null;
  data_ultimo_contato: string | null;
  status_relacionamento: "OK" | "NOK";
}

interface RelacionamentoDetailsDialogProps {
  children: React.ReactNode;
  data: RelacionamentoRow[];
  selectedMonth: string;
  percentual: number;
  clientesOk: number;
  totalClientes: number;
  atingido: boolean;
}

// ===========================================================================
// Helpers
// ===========================================================================

const formatCurrency = (value: number | null) => {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
};

// ===========================================================================
// Componente
// ===========================================================================

export function RelacionamentoDetailsDialog({
  children,
  data,
  selectedMonth,
  percentual,
  clientesOk,
  totalClientes,
  atingido,
}: RelacionamentoDetailsDialogProps) {
  const [activeFilter, setActiveFilter] = useState<"todos" | "nok" | "ok">("todos");
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Deduplica por cliente: para cada cliente pega a linha mais recente com atividade,
  // ou a primeira linha se não tiver (status NOK).
  const clienteMap = React.useMemo(() => {
    const map = new Map<string, RelacionamentoRow>();
    data.forEach((row) => {
      const existing = map.get(row.cliente);
      if (!existing) {
        map.set(row.cliente, row);
      } else {
        // Preferir linhas com atividade (data_esforco não nula) e mais recentes
        const existingDate = existing.data_esforco ?? "";
        const newDate = row.data_esforco ?? "";
        if (newDate > existingDate) {
          map.set(row.cliente, row);
        }
      }
    });
    return map;
  }, [data]);

  const rows = React.useMemo(() => {
    // NOK primeiro, depois OK
    return Array.from(clienteMap.values()).sort((a, b) => {
      if (a.status_relacionamento !== b.status_relacionamento) {
        return a.status_relacionamento === "NOK" ? -1 : 1;
      }
      return (a.cliente ?? "").localeCompare(b.cliente ?? "");
    });
  }, [clienteMap]);

  const filtered = React.useMemo(() => {
    let result = rows.filter((r) => {
      if (activeFilter === "nok" && r.status_relacionamento !== "NOK") return false;
      if (activeFilter === "ok" && r.status_relacionamento !== "OK") return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          r.cliente?.toLowerCase().includes(s) ||
          r.nome_assessor?.toLowerCase().includes(s) ||
          r.cod_assessor?.toLowerCase().includes(s)
        );
      }
      return true;
    });

    if (sortConfig !== null) {
      result.sort((a: any, b: any) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'net_em_m') {
          aValue = aValue ?? 0;
          bValue = bValue ?? 0;
        } else {
          aValue = aValue ?? "";
          bValue = bValue ?? "";
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rows, activeFilter, search, sortConfig]);

  const nokCount = rows.filter((r) => r.status_relacionamento === "NOK").length;
  const okCount = rows.filter((r) => r.status_relacionamento === "OK").length;

  const selectedMonthKey = React.useMemo(() => {
    try {
      return format(parseISO(selectedMonth), "yyyy-MM");
    } catch {
      return String(selectedMonth);
    }
  }, [selectedMonth]);

  const downloadXLSX = () => {
    const exportRows = filtered.map((r) => ({
      status: r.status_relacionamento,
      nome_assessor: r.nome_assessor ?? null,
      cod_assessor: r.cod_assessor ?? null,
      cliente: r.cliente ?? null,
      net_em_m: r.net_em_m ?? null,
      id_atividade: r.id_atividade ?? null,
      pipe: r.pipe ?? null,
      data_esforco: r.data_esforco ?? null,
      data_posicao: r.data_posicao ?? null,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows.length ? exportRows : [{}]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relacionamento");
    XLSX.writeFile(workbook, `relacionamento_${selectedMonthKey}.xlsx`);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="bg-[#0a0e14] border-white/10 text-[#E8E8E0] max-w-5xl w-full p-0 overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center border border-violet-500/40 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                <MessageSquare className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-display text-white tracking-tight">
                  Índice de Relacionamento
                </DialogTitle>
                <p className="text-[11px] font-data text-white/40 uppercase tracking-widest mt-0.5">
                  Cobertura 60 dias · Clientes 300k+ PF
                </p>
              </div>
            </div>

            {/* Resumo do KPI */}
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className={cn(
                  "px-4 py-2 rounded-xl border text-center min-w-[90px]",
                  atingido
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-rose-500/10 border-rose-500/30"
                )}
              >
                <p
                  className={cn(
                    "text-2xl font-display font-bold",
                    atingido ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {(percentual * 100).toFixed(1)}%
                </p>
                <p className="text-[10px] font-data text-white/40 uppercase tracking-widest">
                  {clientesOk}/{totalClientes} clientes
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-data">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{okCount} com contato</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-data">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{nokCount} sem contato recente</span>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="h-9 px-3 text-white/70 hover:text-white hover:bg-white/5"
                onClick={downloadXLSX}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                XLSX
              </Button>
            </div>
          </div>

          {/* Filtros e busca */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            {/* Tabs de filtro */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
              {[
                { key: "todos", label: `Todos (${rows.length})` },
                { key: "nok", label: `⚠ Sem contato (${nokCount})` },
                { key: "ok", label: `✓ Com contato (${okCount})` },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key as "todos" | "nok" | "ok")}
                  className={cn(
                    "px-3 py-1 rounded-md text-[11px] font-data uppercase tracking-widest transition-all",
                    activeFilter === f.key
                      ? f.key === "nok"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : f.key === "ok"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-white/10 text-white border border-white/20"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Busca */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Buscar por cliente ou assessor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[12px] font-data text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
          </div>
        </DialogHeader>

        {/* Tabela */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-6 pt-4 pb-2">
            <div className="bg-euro-card/40 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              {/* Área de scroll nativa para sticky funcionar */}
              <div className="overflow-y-auto max-h-[45vh] custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#0F1520] border-b border-white/10 text-[10px] font-data uppercase tracking-widest text-white/50">
                      <th className="py-3 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('status_relacionamento')}><div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                      <th className="py-3 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('nome_assessor')}><div className="flex items-center gap-1">Assessor <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                      <th className="py-3 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('cliente')}><div className="flex items-center gap-1">Cod. Cliente <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                      <th className="py-3 px-4 font-bold text-right cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('net_em_m')}><div className="flex items-center justify-end gap-1">Net <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                      <th className="py-3 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('id_atividade')}><div className="flex items-center gap-1">ID Atividade <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                      <th className="py-3 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('pipe')}><div className="flex items-center gap-1">Pipe <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                      <th className="py-3 px-4 font-bold cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('data_esforco')}><div className="flex items-center gap-1">Data Esforço <ArrowUpDown className="w-3 h-3 opacity-50" /></div></th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.length > 0 ? (
                    filtered.map((item, idx) => {
                      const isNok = item.status_relacionamento === "NOK";
                      return (
                        <tr
                          key={`${item.cliente}-${idx}`}
                          className={cn(
                            "group transition-all text-[12px] font-data",
                            isNok
                              ? "bg-rose-500/[0.06] hover:bg-rose-500/[0.12] border-l-2 border-l-rose-500/50"
                              : "hover:bg-white/[0.04] border-l-2 border-l-transparent"
                          )}
                        >
                          {/* Status */}
                          <td className="py-3 px-4">
                            {isNok ? (
                              <span className="flex items-center gap-1.5 text-rose-400">
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="text-[10px] uppercase tracking-wider font-bold">NOK</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="text-[10px] uppercase tracking-wider">OK</span>
                              </span>
                            )}
                          </td>

                          {/* Assessor */}
                          <td className="py-3 px-4">
                            <div className="text-white/90 truncate max-w-[120px]" title={item.nome_assessor ?? ""}>
                              {item.nome_assessor ?? "—"}
                            </div>
                            <div className="text-white/30 text-[10px]">{item.cod_assessor ?? ""}</div>
                          </td>

                          {/* Cliente */}
                          <td className="py-3 px-4">
                            <span
                              className={cn(
                                "font-bold tracking-tight",
                                isNok ? "text-rose-200" : "text-white"
                              )}
                            >
                              {item.cliente ?? "—"}
                            </span>
                          </td>

                          {/* Net */}
                          <td className="py-3 px-4 text-right font-mono text-white/70">
                            {formatCurrency(item.net_em_m)}
                          </td>

                          {/* ID Atividade */}
                          <td className="py-3 px-4 text-white/50 font-mono text-[11px]">
                            {item.id_atividade ?? <span className="text-white/20">—</span>}
                          </td>

                          {/* Pipe */}
                          <td className="py-3 px-4 max-w-[160px]">
                            {item.pipe ? (
                              <span className="text-white/70 text-[11px] leading-tight block truncate" title={item.pipe}>
                                {item.pipe}
                              </span>
                            ) : (
                              <span className="text-white/20">—</span>
                            )}
                          </td>

                          {/* Data Esforço */}
                          <td className="py-3 px-4 text-white/50 font-mono text-[11px] whitespace-nowrap">
                            {formatDate(item.data_esforco)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-20 text-center opacity-30">
                        <div className="flex flex-col items-center gap-4">
                          <Users className="w-10 h-10" />
                          <p className="text-sm font-data uppercase tracking-widest">
                            Nenhum cliente encontrado
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Informativo da meta */}
          {(() => {
            const total = okCount + nokCount;
            if (total === 0) return null;
            const metaContatos = Math.ceil(total * 0.90);
            const faltam = Math.max(0, metaContatos - okCount);
            const atingido = okCount >= metaContatos;
            return (
              <div className={`mx-6 mb-4 flex items-start gap-3 p-4 rounded-xl border ${atingido ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
                {atingido ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                )}
                <div className="text-[12px] font-data space-y-1">
                  {atingido ? (
                    <p className="text-emerald-300/90">
                      <span className="font-bold text-emerald-300">Meta atingida!</span>{" "}
                      {okCount} de {total} clientes com contato ({((okCount / total) * 100).toFixed(1)}%).
                    </p>
                  ) : (
                    <>
                      <p className="text-rose-300/90">
                        <span className="font-bold text-rose-300">Faltam {faltam} contato{faltam !== 1 ? "s" : ""}</span>{" "}
                        para atingir a meta de 90%.
                      </p>
                      <p className="text-white/40">
                        Atual: {okCount}/{total} clientes &mdash; Meta: {metaContatos}/{total} ({((metaContatos / total) * 100).toFixed(0)}%)
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
