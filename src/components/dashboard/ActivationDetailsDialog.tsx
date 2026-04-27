import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Target, Search, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import * as XLSX from "xlsx";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
};

interface ActivationDetailsProps {
  children: React.ReactNode;
  selectedMonth: string;
  assessorId: string[];
  team: string[];
}

export function ActivationDetailsDialog({ children, selectedMonth, assessorId, team }: ActivationDetailsProps) {
  const [sortConfig, setSortConfig] = React.useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const { data: details, isLoading } = useQuery({
    queryKey: ["activation-details", selectedMonth, assessorId, team],
    queryFn: async () => {
      let query = supabase
        .from("detalhamento_ativacoes" as any)
        .select("*")
        .eq("data_posicao", selectedMonth);

      if (assessorId.length > 0) {
        // Normalize codes to always have "A" prefix
        const normalizedCodes = assessorId.map(id => id.startsWith("A") ? id : `A${id}`);
        query = query.in("cod_assessor", normalizedCodes);
      } else if (team.length > 0) {
        // detalhamento_ativacoes doesn't have a "time" column,
        // so look up which assessors belong to the selected team(s)
        const { data: teamAssessors } = await supabase
          .from("mv_resumo_assessor" as any)
          .select("cod_assessor")
          .eq("data_posicao", selectedMonth)
          .in("time", team);

        const assessorCodes = [...new Set((teamAssessors || []).map((a: any) => a.cod_assessor).filter(Boolean))];

        if (assessorCodes.length === 0) {
          return [];
        }

        query = query.in("cod_assessor", assessorCodes);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching activation details:", error);
        return [];
      }
      return data as any[];
    },
    enabled: !!selectedMonth,
  });

  const sortedDetails = React.useMemo(() => {
    if (!details) return [];
    let sortableItems = [...details];
    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'net_original_texto') {
          aValue = parseFloat(String(a.net_original_texto || "0").replace(",", ".")) || 0;
          bValue = parseFloat(String(b.net_original_texto || "0").replace(",", ".")) || 0;
        } else if (sortConfig.key === 'valor_ativacao_final') {
          aValue = aValue || 0;
          bValue = bValue || 0;
        } else {
          aValue = aValue || "";
          bValue = bValue || "";
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [details, sortConfig]);

  const selectedMonthKey = React.useMemo(() => {
    try {
      return format(parseISO(selectedMonth), "yyyy-MM");
    } catch {
      return String(selectedMonth);
    }
  }, [selectedMonth]);

  const downloadXLSX = () => {
    const rows = (details ?? []).map((item: any) => ({
      assessor: item.cod_assessor ?? null,
      cliente: item.cliente ?? null,
      net_original: item.net_original_texto ?? null,
      valor_ativacao_final: item.valor_ativacao_final ?? null,
      data_posicao: item.data_posicao ?? null,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ativacoes 300k+");
    XLSX.writeFile(workbook, `ativacoes_300k_${selectedMonthKey}.xlsx`);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="bg-[#0a0e14] border-white/10 text-[#E8E8E0] max-w-3xl p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <DialogHeader className="p-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-euro-gold/20 flex items-center justify-center border border-euro-gold/40 shadow-[0_0_20px_rgba(250,192,23,0.1)]">
              <Target className="w-5 h-5 text-euro-gold" />
            </div>
            <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
              <DialogTitle className="text-2xl font-display text-euro-gold tracking-tight">
                Detalhamento de Ativações 300k+
              </DialogTitle>
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
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-6">
            <div className="bg-euro-card/40 border border-white/10 rounded-xl overflow-hidden shadow-2xl relative">
              {isLoading && <LoadingOverlay isLoading={true} />}
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest">
                    <th className="py-3 px-4 font-bold border-r border-euro-navy/10 cursor-pointer hover:bg-euro-navy/5 transition-colors" onClick={() => handleSort('cod_assessor')}>
                      <div className="flex items-center gap-1">Assessor <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                    </th>
                    <th className="py-3 px-4 font-bold border-r border-euro-navy/10 cursor-pointer hover:bg-euro-navy/5 transition-colors" onClick={() => handleSort('cliente')}>
                      <div className="flex items-center gap-1">Cliente <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                    </th>
                    <th className="py-3 px-4 font-bold text-right border-r border-euro-navy/10 cursor-pointer hover:bg-euro-navy/5 transition-colors" onClick={() => handleSort('net_original_texto')}>
                      <div className="flex items-center justify-end gap-1">Net Original <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                    </th>
                    <th className="py-3 px-4 font-bold text-right cursor-pointer hover:bg-euro-navy/5 transition-colors" onClick={() => handleSort('valor_ativacao_final')}>
                      <div className="flex items-center justify-end gap-1">Vlr Ativação <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {sortedDetails && sortedDetails.length > 0 ? (
                    sortedDetails.map((item, idx) => (
                      <tr
                        key={idx}
                        className="group even:bg-white/[0.02] hover:bg-white/[0.05] transition-all text-[12.6px] font-data"
                      >
                        <td className="py-3 px-4 border-r border-white/5 text-white">
                          {item.cod_assessor || "N/A"}
                        </td>
                        <td className="py-3 px-4 border-r border-white/5">
                          <span className="font-bold uppercase tracking-tight text-white">
                            {item.cliente || "N/A"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-white border-r border-white/5">
                          {formatCurrency(parseFloat(String(item.net_original_texto || "0").replace(",", ".")) || 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-euro-gold">
                          {formatCurrency(item.valor_ativacao_final || 0)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-20 text-center opacity-20">
                        <div className="flex flex-col items-center gap-4">
                          <Search className="w-10 h-10" />
                          <p className="text-sm font-data uppercase tracking-widest">Nenhuma ativação encontrada</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
