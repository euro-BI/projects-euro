import React, { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import { Landmark, PieChart, Shield, Landmark as Bank, DollarSign, Wallet, User, Search, ArrowUpDown, ArrowUp, ArrowDown, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import * as XLSX from "xlsx";

interface ProdutosRFDashProps {
  selectedMonth: string;
  selectedYear: string;
  selectedTeam: string[];
  selectedAssessorId: string[];
  teamPhotos?: Map<string, string>;
}

const formatCurrency = (value: number, decimals: number = 2) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

const parseNet = (val: string | null) => {
  if (!val) return 0;
  const cleanStr = val.replace(/["']/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};

export default function ProdutosRFDash({
  selectedMonth,
  selectedYear,
  selectedTeam,
  selectedAssessorId,
  teamPhotos,
}: ProdutosRFDashProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [detailSearchTerm, setDetailSearchTerm] = useState("");
  const [selectedAssessorForDetails, setSelectedAssessorForDetails] = useState<{ cod_assessor: string, nome: string, product: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'total',
    direction: 'desc'
  });
  const [detailSortConfig, setDetailSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'parsedNet',
    direction: 'desc'
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [detailSearchTerm]);

  const selectedMonthKey = selectedMonth
    ? selectedMonth.substring(0, 7)
    : `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const selectedMonthEndDate = format(endOfMonth(parseISO(`${selectedMonthKey}-01`)), "yyyy-MM-dd");

  const { data: diversificadorData, isLoading } = useQuery({
    queryKey: ["produtos-rf-data", selectedMonthKey, selectedTeam, selectedAssessorId],
    queryFn: async () => {
      // If we have assessor filters, we first get their codes/names from mv_resumo_assessor
      // to map them properly since dados_diversificador_full has 'assessor' which might be name or code.
      let validAssessors = new Set<string>();
      const assessorMap = new Map<string, any>();
      
      // Always fetch assessor mapping for the table, regardless of filters
      let mvQuery = supabase
        .from("mv_resumo_assessor" as any)
        .select("cod_assessor, nome_assessor, time, foto_url, lider, cluster")
        .gte("data_posicao", `${selectedMonthKey}-01`)
        .lte("data_posicao", selectedMonthEndDate);

      if (selectedTeam.length > 0) {
        mvQuery = mvQuery.in("time", selectedTeam);
      }
      if (selectedAssessorId.length > 0) {
        mvQuery = mvQuery.in("cod_assessor", selectedAssessorId);
      }

      const { data: mvRows } = await mvQuery;
      
      (mvRows as any[] || []).forEach((r: any) => {
        if (r.cod_assessor) {
          const code = r.cod_assessor.toUpperCase();
          validAssessors.add(code);
          assessorMap.set(code, r);
        }
      });// Fetch the full diversificador data up to the end of the selected month
      const endDate = selectedMonthEndDate;

      let query = supabase
        .from("dados_diversificador_full" as any)
        .select("produto, net, data_posicao, assessor, cliente, subproduto, cnpj, fator_risco, ativo, data_vencimento")
        .lte("data_posicao", endDate);

      const { data, error } = await query;
      if (error) throw error;
      
      let filteredData = data || [];
      // Filter by assessor if needed
      if (selectedTeam.length > 0 || selectedAssessorId.length > 0) {
        filteredData = filteredData.filter(row => {
          const rawAssessor = (row.assessor || "").trim();
          const codAssessorStr = rawAssessor.toUpperCase().startsWith("A") 
            ? rawAssessor.toUpperCase() 
            : `A${rawAssessor}`.toUpperCase();
            
          return validAssessors.has(codAssessorStr);
        });
      }

      return { data: filteredData, assessorMap };
    }
  });

  const { totals, tableData, detailData } = useMemo(() => {
    const result = {
      "Fundos": 0,
      "Previdência": 0,
      "Renda Fixa": 0,
      "Tesouro Direto": 0
    };
    
    if (!diversificadorData || !diversificadorData.data) return { totals: result, tableData: [], detailData: [] };
    
    // Usually position tables contain snapshots. Let's find the latest data_posicao first.
    const latestDate = diversificadorData.data.reduce((max, row) => {
      if (!row.data_posicao) return max;
      return row.data_posicao > max ? row.data_posicao : max;
    }, "");

    // If we found a date, only sum rows from that date to avoid duplicating amounts across snapshots.
    const rowsToSum = latestDate 
      ? diversificadorData.data.filter(row => row.data_posicao === latestDate)
      : diversificadorData.data;
      
    const byAssessor = new Map<string, any>();
    
    rowsToSum.forEach(row => {
      const prod = (row.produto as string || "").toUpperCase().trim();
      const val = parseNet(row.net);
      
      const rawAssessor = (row.assessor || "").trim();
      const codAssessorStr = rawAssessor.toUpperCase().startsWith("A") 
        ? rawAssessor.toUpperCase() 
        : `A${rawAssessor}`.toUpperCase();
        
      if (!byAssessor.has(codAssessorStr)) {
        const info = diversificadorData.assessorMap?.get(codAssessorStr) || {};
        byAssessor.set(codAssessorStr, {
          cod_assessor: codAssessorStr,
          nome_assessor: info.nome_assessor || codAssessorStr,
          time: info.time || "",
          foto_url: info.foto_url || null,
          lider: info.lider || false,
          cluster: info.cluster || "",
          Fundos: 0,
          Previdencia: 0,
          RendaFixa: 0,
          TesouroDireto: 0,
          total: 0
        });
      }
      
      const stats = byAssessor.get(codAssessorStr)!;
      
      if (prod === "FUNDOS" || prod === "FUNDO DE INVESTIMENTO") {
        result["Fundos"] += val;
        stats.Fundos += val;
      } else if (prod === "PREVIDÊNCIA" || prod === "PREVIDENCIA") {
        result["Previdência"] += val;
        stats.Previdencia += val;
      } else if (prod === "RENDA FIXA") {
        result["Renda Fixa"] += val;
        stats.RendaFixa += val;
      } else if (prod === "TESOURO DIRETO") {
        result["Tesouro Direto"] += val;
        stats.TesouroDireto += val;
      }
      stats.total += val;
    });
    
    const tableArray = Array.from(byAssessor.values())
      .filter((a) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          (a.nome_assessor || "").toLowerCase().includes(term) ||
          (a.cod_assessor || "").toLowerCase().includes(term) ||
          (a.time || "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        let aVal: any = a[key as keyof typeof a];
        let bVal: any = b[key as keyof typeof b];
        if (aVal == null) aVal = "";
        if (bVal == null) bVal = "";
        if (typeof aVal === 'string') {
          return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return direction === 'asc' ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1);
      });
      
    const detailArray = rowsToSum.map(row => {
      const rawAssessor = (row.assessor || "").trim();
      const codAssessorStr = rawAssessor.toUpperCase().startsWith("A") 
        ? rawAssessor.toUpperCase() 
        : `A${rawAssessor}`.toUpperCase();
        
      const info = diversificadorData.assessorMap?.get(codAssessorStr) || {};
      
      return {
        ...row,
        codAssessorStr,
        nome_assessor: info.nome_assessor || codAssessorStr,
        parsedNet: parseNet(row.net)
      };
    }).filter(row => {
      if (!detailSearchTerm) return true;
      const term = detailSearchTerm.toLowerCase();
      return (
        (row.cliente || "").toLowerCase().includes(term) ||
        (row.cnpj || "").toLowerCase().includes(term) ||
        (row.subproduto || "").toLowerCase().includes(term) ||
        (row.ativo || "").toLowerCase().includes(term)
      );
    }).sort((a, b) => {
      const { key, direction } = detailSortConfig;
      let aVal: any = a[key as keyof typeof a];
      let bVal: any = b[key as keyof typeof b];
      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";
      if (typeof aVal === 'string') {
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return direction === 'asc' ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1);
    });
    
    return { totals: result, tableData: tableArray, detailData: detailArray };
  }, [diversificadorData, searchTerm, detailSearchTerm, sortConfig, detailSortConfig]);

  const modalData = useMemo(() => {
    if (!selectedAssessorForDetails || !diversificadorData?.data) return [];
    
    const latestDate = diversificadorData.data.reduce((max, row) => {
      if (!row.data_posicao) return max;
      return row.data_posicao > max ? row.data_posicao : max;
    }, "");

    const rowsToSum = latestDate 
      ? diversificadorData.data.filter(row => row.data_posicao === latestDate)
      : diversificadorData.data;

    const subproductAgg = new Map<string, { produto: string, subproduto: string, net: number }>();

    rowsToSum.forEach(row => {
      const rawAssessor = (row.assessor || "").trim();
      const codAssessorStr = rawAssessor.toUpperCase().startsWith("A") 
        ? rawAssessor.toUpperCase() 
        : `A${rawAssessor}`.toUpperCase();
        
      if (codAssessorStr !== selectedAssessorForDetails.cod_assessor) return;

      const prodRaw = (row.produto as string || "").toUpperCase().trim();
      const subprod = (row.subproduto as string || "N/A").trim();
      const val = parseNet(row.net);
      
      let prodNormalized = prodRaw;
      if (prodRaw === "FUNDOS" || prodRaw === "FUNDO DE INVESTIMENTO") prodNormalized = "Fundos";
      else if (prodRaw === "PREVIDÊNCIA" || prodRaw === "PREVIDENCIA") prodNormalized = "Previdência";
      else if (prodRaw === "RENDA FIXA") prodNormalized = "Renda Fixa";
      else if (prodRaw === "TESOURO DIRETO") prodNormalized = "Tesouro Direto";

      if (selectedAssessorForDetails.product !== "Total" && prodNormalized !== selectedAssessorForDetails.product) return;

      const key = `${prodNormalized}-${subprod}`;
      if (!subproductAgg.has(key)) {
        subproductAgg.set(key, { produto: prodNormalized, subproduto: subprod, net: 0 });
      }
      subproductAgg.get(key)!.net += val;
    });

    return Array.from(subproductAgg.values()).sort((a, b) => b.net - a.net);
  }, [selectedAssessorForDetails, diversificadorData]);

  const cards = [
    {
      title: "Renda Fixa",
      value: totals["Renda Fixa"],
      icon: Bank,
      color: "#3B82F6"
    },
    {
      title: "Fundos",
      value: totals["Fundos"],
      icon: PieChart,
      color: "#8B5CF6"
    },
    {
      title: "Previdência",
      value: totals["Previdência"],
      icon: Shield,
      color: "#22C55E"
    },
    {
      title: "Tesouro Direto",
      value: totals["Tesouro Direto"],
      icon: Wallet,
      color: "#F59E0B"
    }
  ];

  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
    });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-auto" />
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-auto" />;
  };

  const handleDetailSort = (key: string) => {
    setDetailSortConfig({
      key,
      direction: detailSortConfig.key === key && detailSortConfig.direction === 'desc' ? 'asc' : 'desc'
    });
  };

  const DetailSortIcon = ({ column }: { column: string }) => {
    if (detailSortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return detailSortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-auto" />
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-auto" />;
  };

  const formattedMonth = useMemo(() => {
    if (!selectedMonth) return "";
    try {
      return format(parseISO(selectedMonth), "MMMM yyyy", { locale: ptBR });
    } catch { return ""; }
  }, [selectedMonth]);

  const handleExportDetails = () => {
    if (!detailData || detailData.length === 0) return;
    
    const ws = XLSX.utils.json_to_sheet(detailData.map(row => ({
      "Código Assessor": row.codAssessorStr,
      "Nome Assessor": row.nome_assessor,
      "Cliente": row.cliente || "",
      "Produto": row.produto || "",
      "Subproduto": row.subproduto || "",
      "CNPJ": row.cnpj || "",
      "Fator Risco": row.fator_risco || "",
      "Ativo": row.ativo || "",
      "Data Vencimento": row.data_vencimento ? format(parseISO(row.data_vencimento), "dd/MM/yyyy") : "",
      "Net": row.parsedNet
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalhamento");
    XLSX.writeFile(wb, `detalhamento_rf_${selectedMonthKey}.xlsx`);
  };

  const totalPages = Math.ceil((detailData?.length || 0) / itemsPerPage);
  const paginatedData = detailData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <LoadingOverlay isLoading={isLoading} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="h-full"
            >
              <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden group hover:border-euro-gold/40 transition-all duration-300 h-full">
                <div 
                  className="absolute top-0 left-0 w-1 h-full opacity-50 hidden md:block" 
                  style={{ background: card.color }} 
                />
                <CardHeader className="pb-2 pt-6 pl-6 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-data uppercase tracking-widest text-white/50">
                    {card.title}
                  </CardTitle>
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center -mt-2 shadow-lg" 
                    style={{ background: `${card.color}20` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: card.color }} />
                  </div>
                </CardHeader>
                <CardContent className="pb-6 pt-2 pl-6">
                  <div className="flex flex-col">
                    <span className="text-3xl font-display text-white tracking-wide">
                      {formatCurrency(card.value)}
                    </span>
                    <span className="text-xs font-data text-white/30 uppercase tracking-wider mt-1">
                      Total Net
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Table Section */}
      <div className="space-y-6 hidden lg:block pt-8">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
          <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase flex-shrink-0">
            Resumo Produtos RF por Assessor {formattedMonth ? `(${formattedMonth})` : ""}
          </h3>
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold transition-colors" />
            <Input
              type="text"
              placeholder="Buscar assessor por nome ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 transition-all h-10"
            />
          </div>
        </div>

        <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />

          <div className="overflow-auto custom-scrollbar relative max-h-[650px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-30">
                <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                  <th
                    onClick={() => handleSort('time')}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 bg-euro-gold z-40 w-[80px] min-w-[80px] max-w-[80px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Time <SortIcon column="time" /></div>
                  </th>
                  <th
                    onClick={() => handleSort('nome_assessor')}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-[80px] bg-euro-gold z-40 min-w-[220px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Assessor <SortIcon column="nome_assessor" /></div>
                  </th>
                  <th
                    onClick={() => handleSort('total')}
                    className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors border-r border-euro-navy/5"
                  >
                    <div className="flex items-center justify-end gap-2">Total Net <SortIcon column="total" /></div>
                  </th>
                  <th
                    onClick={() => handleSort('RendaFixa')}
                    className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors border-r border-euro-navy/5"
                  >
                    <div className="flex items-center justify-end gap-2">Renda Fixa <SortIcon column="RendaFixa" /></div>
                  </th>
                  <th
                    onClick={() => handleSort('Fundos')}
                    className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors border-r border-euro-navy/5"
                  >
                    <div className="flex items-center justify-end gap-2">Fundos <SortIcon column="Fundos" /></div>
                  </th>
                  <th
                    onClick={() => handleSort('Previdencia')}
                    className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors border-r border-euro-navy/5"
                  >
                    <div className="flex items-center justify-end gap-2">Previdência <SortIcon column="Previdencia" /></div>
                  </th>
                  <th
                    onClick={() => handleSort('TesouroDireto')}
                    className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-2">Tesouro Direto <SortIcon column="TesouroDireto" /></div>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.05]">
                {tableData.map((item) => (
                  <tr
                    key={item.cod_assessor}
                    className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all text-xs font-data"
                  >
                    <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10 w-[80px] min-w-[80px] max-w-[80px]">
                      <div className="flex items-center justify-center">
                        {teamPhotos?.has(item.time.toUpperCase()) ? (
                          <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                            <img src={teamPhotos.get(item.time.toUpperCase())} alt={item.time} className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold">
                            {item.time.substring(0, 3).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-white/10 sticky left-[80px] bg-euro-navy group-hover:bg-[#1e2538] z-10">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div className={cn(
                            "w-10 h-10 rounded-full bg-euro-inset flex items-center justify-center text-xs font-bold text-euro-gold/40 border border-white/10 overflow-hidden group-hover:border-euro-gold transition-colors",
                            item.lider && "border-euro-gold shadow-[0_0_12px_rgba(250,192,23,0.3)]"
                          )}>
                            {item.foto_url ? (
                              <img src={item.foto_url} alt={item.nome_assessor} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 opacity-20" />
                            )}
                          </div>
                          {item.lider && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-euro-gold rounded-full flex items-center justify-center shadow-lg">
                              <Shield className="w-2 h-2 text-euro-navy" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-white font-bold truncate group-hover:text-euro-gold transition-colors uppercase tracking-tight">
                            {item.nome_assessor}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-white/90 font-medium">
                            <span className="font-mono">{item.cod_assessor}</span>
                            {item.cluster && (
                              <>
                                <span className="text-white/40">•</span>
                                <span className="uppercase">{item.cluster}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td 
                      className="py-3 px-4 text-right border-r border-white/5 cursor-pointer hover:bg-white/5 transition-colors group/cell"
                      onClick={() => setSelectedAssessorForDetails({ cod_assessor: item.cod_assessor, nome: item.nome_assessor, product: 'Total' })}
                    >
                      <span className="font-bold text-white group-hover/cell:text-euro-gold transition-colors">{formatCurrency(item.total)}</span>
                    </td>
                    <td 
                      className="py-3 px-4 text-right text-white/80 border-r border-white/5 cursor-pointer hover:bg-white/5 transition-colors group/cell"
                      onClick={() => setSelectedAssessorForDetails({ cod_assessor: item.cod_assessor, nome: item.nome_assessor, product: 'Renda Fixa' })}
                    >
                      <span className="group-hover/cell:text-euro-gold transition-colors">{formatCurrency(item.RendaFixa)}</span>
                    </td>
                    <td 
                      className="py-3 px-4 text-right text-white/80 border-r border-white/5 cursor-pointer hover:bg-white/5 transition-colors group/cell"
                      onClick={() => setSelectedAssessorForDetails({ cod_assessor: item.cod_assessor, nome: item.nome_assessor, product: 'Fundos' })}
                    >
                      <span className="group-hover/cell:text-euro-gold transition-colors">{formatCurrency(item.Fundos)}</span>
                    </td>
                    <td 
                      className="py-3 px-4 text-right text-white/80 border-r border-white/5 cursor-pointer hover:bg-white/5 transition-colors group/cell"
                      onClick={() => setSelectedAssessorForDetails({ cod_assessor: item.cod_assessor, nome: item.nome_assessor, product: 'Previdência' })}
                    >
                      <span className="group-hover/cell:text-euro-gold transition-colors">{formatCurrency(item.Previdencia)}</span>
                    </td>
                    <td 
                      className="py-3 px-4 text-right text-white/80 cursor-pointer hover:bg-white/5 transition-colors group/cell"
                      onClick={() => setSelectedAssessorForDetails({ cod_assessor: item.cod_assessor, nome: item.nome_assessor, product: 'Tesouro Direto' })}
                    >
                      <span className="group-hover/cell:text-euro-gold transition-colors">{formatCurrency(item.TesouroDireto)}</span>
                    </td>
                  </tr>
                ))}
                {tableData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-20 text-center opacity-20">
                      <div className="flex flex-col items-center gap-4">
                        <Search className="w-10 h-10" />
                        <p className="text-sm font-data uppercase tracking-widest">Nenhum assessor encontrado</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>

              <tfoot className="sticky bottom-0 z-30">
                <tr className="bg-black/80 backdrop-blur-md text-xs font-bold font-data border-t-2 border-euro-gold">
                  <td className="py-4 px-4 text-euro-gold uppercase tracking-widest sticky left-0 bg-black/90 z-40 border-r border-white/10 w-[80px] min-w-[80px] max-w-[80px]">Total</td>
                  <td className="sticky left-[80px] bg-black/90 z-40 border-r border-white/10"></td>
                  <td className="py-4 px-4 text-right text-euro-gold border-r border-white/5 bg-black/80">{formatCurrency(totals["Fundos"] + totals["Previdência"] + totals["Renda Fixa"] + totals["Tesouro Direto"])}</td>
                  <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals["Renda Fixa"])}</td>
                  <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals["Fundos"])}</td>
                  <td className="py-4 px-4 text-right text-white border-r border-white/5 bg-black/80">{formatCurrency(totals["Previdência"])}</td>
                  <td className="py-4 px-4 text-right text-white bg-black/80">{formatCurrency(totals["Tesouro Direto"])}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Table Section */}
      <div className="space-y-6 hidden lg:block pt-8">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
          <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase flex-shrink-0">
            Detalhamento de Ativos {formattedMonth ? `(${formattedMonth})` : ""}
          </h3>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold transition-colors" />
              <Input
                type="text"
                placeholder="Buscar cliente, ativo, cnpj, subproduto..."
                value={detailSearchTerm}
                onChange={(e) => setDetailSearchTerm(e.target.value)}
                className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 transition-all h-10"
              />
            </div>
            <button
              onClick={handleExportDetails}
              className="flex items-center gap-2 px-4 py-2 bg-euro-elevated border border-white/10 rounded-lg text-white text-xs font-bold uppercase tracking-widest hover:border-euro-gold hover:text-euro-gold transition-colors shrink-0 h-10"
            >
              <Download className="w-4 h-4" />
              Baixar XLSX
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />

          <div className="overflow-auto custom-scrollbar relative max-h-[650px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-30">
                <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                  <th onClick={() => handleDetailSort('nome_assessor')} className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 bg-euro-gold z-40 min-w-[200px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                    <div className="flex items-center gap-2">Assessor <DetailSortIcon column="nome_assessor" /></div>
                  </th>
                  <th onClick={() => handleDetailSort('cliente')} className="py-4 px-4 font-bold border-r border-euro-navy/5 min-w-[120px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                    <div className="flex items-center gap-2">Cliente <DetailSortIcon column="cliente" /></div>
                  </th>
                  <th onClick={() => handleDetailSort('produto')} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                    <div className="flex items-center gap-2">Produto <DetailSortIcon column="produto" /></div>
                  </th>
                  <th onClick={() => handleDetailSort('subproduto')} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                    <div className="flex items-center gap-2">Subproduto <DetailSortIcon column="subproduto" /></div>
                  </th>
                  <th onClick={() => handleDetailSort('cnpj')} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                    <div className="flex items-center gap-2">CNPJ <DetailSortIcon column="cnpj" /></div>
                  </th>
                  <th onClick={() => handleDetailSort('fator_risco')} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                    <div className="flex items-center gap-2">Fator Risco <DetailSortIcon column="fator_risco" /></div>
                  </th>
                  <th onClick={() => handleDetailSort('ativo')} className="py-4 px-4 font-bold border-r border-euro-navy/5 min-w-[150px] cursor-pointer hover:bg-euro-gold/80 transition-colors">
                    <div className="flex items-center gap-2">Ativo <DetailSortIcon column="ativo" /></div>
                  </th>
                  <th onClick={() => handleDetailSort('data_vencimento')} className="py-4 px-4 font-bold border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors">
                    <div className="flex items-center gap-2">Data Venc. <DetailSortIcon column="data_vencimento" /></div>
                  </th>
                  <th onClick={() => handleDetailSort('parsedNet')} className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors">
                    <div className="flex items-center justify-end gap-2">Net <DetailSortIcon column="parsedNet" /></div>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.05]">
                {paginatedData.map((item, idx) => (
                  <tr key={idx} className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all text-xs font-data">
                    <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10">
                      <div className="flex flex-col">
                        <span className="text-white font-bold">{item.nome_assessor}</span>
                        <span className="text-white/50 text-[10px] font-mono">{item.codAssessorStr}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-white border-r border-white/5">{item.cliente || "—"}</td>
                    <td className="py-3 px-4 text-white/80 border-r border-white/5">{item.produto || "—"}</td>
                    <td className="py-3 px-4 text-white/80 border-r border-white/5">{item.subproduto || "—"}</td>
                    <td className="py-3 px-4 text-white/80 border-r border-white/5 font-mono">{item.cnpj || "—"}</td>
                    <td className="py-3 px-4 text-white/80 border-r border-white/5">{item.fator_risco || "—"}</td>
                    <td className="py-3 px-4 text-white border-r border-white/5 max-w-[250px] truncate" title={item.ativo}>{item.ativo || "—"}</td>
                    <td className="py-3 px-4 text-white/80 border-r border-white/5">
                      {item.data_vencimento ? format(parseISO(item.data_vencimento), "dd/MM/yyyy") : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white">
                      {formatCurrency(item.parsedNet)}
                    </td>
                  </tr>
                ))}
                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-20 text-center opacity-20">
                      Nenhum registro encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {detailData.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-euro-navy/50">
              <div className="text-xs text-white/50 font-data">
                Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, detailData.length)} a {Math.min(currentPage * itemsPerPage, detailData.length)} de {detailData.length} registros
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded bg-euro-elevated border border-white/5 text-white/70 disabled:opacity-30 hover:border-euro-gold hover:text-euro-gold transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-xs text-white/70 font-data px-2">
                  Página {currentPage} de {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-1.5 rounded bg-euro-elevated border border-white/5 text-white/70 disabled:opacity-30 hover:border-euro-gold hover:text-euro-gold transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subproduct Details Modal */}
      <Dialog open={!!selectedAssessorForDetails} onOpenChange={(open) => !open && setSelectedAssessorForDetails(null)}>
        <DialogContent className="bg-euro-navy border border-white/10 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-display text-euro-gold">
              Detalhamento por Subproduto
            </DialogTitle>
            <div className="text-sm text-white/50 font-data uppercase tracking-widest mt-1">
              {selectedAssessorForDetails?.nome} • {selectedAssessorForDetails?.product === "Total" ? "Todos os Produtos" : selectedAssessorForDetails?.product}
            </div>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh] custom-scrollbar mt-4">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-30">
                <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                  <th className="py-3 px-4 font-bold border-r border-euro-navy/10">Produto</th>
                  <th className="py-3 px-4 font-bold border-r border-euro-navy/10">Subproduto</th>
                  <th className="py-3 px-4 font-bold text-right">Total Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {modalData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors text-xs font-data">
                    <td className="py-3 px-4 border-r border-white/5 text-white/80">{row.produto}</td>
                    <td className="py-3 px-4 border-r border-white/5 text-white/80">{row.subproduto}</td>
                    <td className="py-3 px-4 text-right font-bold text-white">{formatCurrency(row.net)}</td>
                  </tr>
                ))}
                {modalData.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-white/30 text-xs font-data uppercase tracking-widest">
                      Nenhum dado encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
