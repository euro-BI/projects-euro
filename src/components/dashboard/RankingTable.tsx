import React, { useMemo, useState } from "react";
import { AssessorResumo } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { 
  Trophy, 
  User, 
  Grid,
  Check,
  ChevronsUpDown,
  Filter,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { format, parseISO, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";

const BLOCKED_TEAMS = ["ANYWHERE", "OPERACIONAIS"];
const BLOCKED_ASSESSORS = ["A1607", "A20680", "A39869", "A50655", "A26969"];

interface RankingTableProps {
  data: AssessorResumo[];
  selectedYear: string;
}

export default function RankingTable({ data, selectedYear }: RankingTableProps) {
  const [selectedCluster, setSelectedCluster] = useState<string | null>("A");
  const [openClusterCombobox, setOpenClusterCombobox] = useState(false);

  // Extract clusters list
  const clustersList = useMemo(() => {
    const clusters = new Set<string>();
    data.forEach(d => {
      if (d.cluster && d.cluster !== "ADV") clusters.add(d.cluster);
    });
    return Array.from(clusters).sort();
  }, [data]);

  // Aggregate and filter data
  const rankingData = useMemo(() => {
    if (!data.length) return [];

    const validData = data.filter(d => {
      if (!d.data_posicao || !d.nome_assessor || d.nome_assessor.trim().length === 0 || d.nome_assessor.toLowerCase() === "null" || d.nome_assessor.toLowerCase() === "undefined") return false;
      if (d.time && BLOCKED_TEAMS.includes(d.time)) return false;
      if (d.cod_assessor && BLOCKED_ASSESSORS.includes(d.cod_assessor)) return false;
      if (getYear(parseISO(d.data_posicao)).toString() !== selectedYear) return false;
      if (selectedCluster && d.cluster !== selectedCluster) return false;
      return true;
    });

    // Group by assessor
    const grouped = validData.reduce((acc: Record<string, any>, curr) => {
      const key = curr.cod_assessor;
      if (!acc[key]) {
        acc[key] = {
          ...curr,
          pontos_captacao: 0,
          pontos_roa_invest: 0,
          pontos_roa_cs: 0,
          pontos_ativacoes: 0,
          pontos_lider: 0,
          pontos_total: 0,
          captacao_liquida_total: 0,
          ativacao_300k: 0,
          ativacao_1kk: 0,
          latest_date: curr.data_posicao,
          latest_custodia: curr.custodia_net
        };
      }
      
      acc[key].pontos_captacao += curr.pontos_captacao || 0;
      acc[key].pontos_roa_invest += curr.pontos_roa_invest || 0;
      acc[key].pontos_roa_cs += curr.pontos_roa_cs || 0;
      acc[key].pontos_ativacoes += curr.pontos_ativacoes || 0;
      acc[key].pontos_lider += curr.pontos_lider || 0;
      acc[key].pontos_total += curr.pontos_total || 0;
      acc[key].captacao_liquida_total += curr.captacao_liquida_total || 0;
      acc[key].ativacao_300k += curr.ativacao_300k || 0;
      acc[key].ativacao_1kk += curr.ativacao_1kk || 0;
      
      // Keep latest custody
      if (curr.data_posicao > acc[key].latest_date) {
        acc[key].latest_date = curr.data_posicao;
        acc[key].latest_custodia = curr.custodia_net;
      }
      
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => b.pontos_total - a.pontos_total);
  }, [data, selectedYear, selectedCluster]);

  return (
    <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header Section */}
      <div className="p-8 border-b border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h3 className="text-sm font-data text-euro-gold/60 uppercase tracking-[0.2em] flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Detalhamento de Pontuação por Cluster
            </h3>
            <p className="text-xs font-data text-white/40 uppercase tracking-widest">
              Performance consolidada do ano de {selectedYear}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Cluster Selector */}
            <Popover open={openClusterCombobox} onOpenChange={setOpenClusterCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "h-9 w-[200px] justify-between bg-euro-navy/40 border-white/10 text-[10px] font-data uppercase tracking-wider",
                    selectedCluster && "border-euro-gold text-euro-gold"
                  )}
                >
                  <div className="flex items-center truncate">
                    <Grid className="w-3 h-3 mr-2 opacity-50" />
                    <span className="truncate">
                      {selectedCluster || "Filtrar Cluster"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0 bg-euro-elevated border-white/10">
                <Command className="bg-euro-elevated">
                  <CommandInput placeholder="Buscar Cluster..." className="h-8 text-[10px] font-data" />
                  <CommandList>
                    <CommandEmpty className="text-[10px] font-data p-2">Não encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setSelectedCluster(null);
                          setOpenClusterCombobox(false);
                        }}
                        className="text-[10px] font-data uppercase tracking-wider"
                      >
                        <Check className={cn("mr-2 h-3 w-3", !selectedCluster ? "opacity-100" : "opacity-0")} />
                        Todos os Clusters
                      </CommandItem>
                      {clustersList.map((cluster) => (
                        <CommandItem
                          key={cluster}
                          onSelect={() => {
                            setSelectedCluster(cluster);
                            setOpenClusterCombobox(false);
                          }}
                          className="text-[10px] font-data uppercase tracking-wider"
                        >
                          <Check className={cn("mr-2 h-3 w-3", selectedCluster === cluster ? "opacity-100 text-euro-gold" : "opacity-0")} />
                          {cluster}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-euro-card/95 backdrop-blur-md border-b border-white/10">
            <tr className="text-xs font-data text-[#8A8A7A] uppercase tracking-wider">
              <th className="p-4 font-normal">#</th>
              <th className="p-4 font-normal">Assessor</th>
              <th className="p-4 font-normal text-right">Net</th>
              <th className="p-4 font-normal text-right">Pontos Totais</th>
              <th className="p-4 font-normal text-right">P. Captação</th>
              <th className="p-4 font-normal text-right">Captação Liq.</th>
              <th className="p-4 font-normal text-right">P. ROA Invest</th>
              <th className="p-4 font-normal text-right">P. ROA CS</th>
              <th className="p-4 font-normal text-right">Ativ.</th>
              <th className="p-4 font-normal text-right">Ativ 300k+</th>
              <th className="p-4 font-normal text-right">Ativ 1M</th>
              <th className="p-4 font-normal text-right">P. Líder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {rankingData.map((assessor: any, idx) => {
              const isInelegivel = assessor.elegibilidade === false || assessor.elegibilidade === "false";

              return (
                <tr 
                  key={assessor.cod_assessor}
                  className="group hover:bg-white/[0.05] transition-colors"
                >
                  <td className="p-4 text-sm font-data text-[#8A8A7A]">{idx + 1}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3 relative">
                      <div className="w-8 h-8 rounded-full bg-euro-inset border border-white/10 overflow-hidden flex-shrink-0">
                        {assessor.foto_url ? (
                          <img src={assessor.foto_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] opacity-30 text-white">
                            {assessor.nome_assessor ? (
                              assessor.nome_assessor.split(" ").map((n: string) => n[0]).join("").slice(0, 2)
                            ) : "A"}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className={cn(
                          "text-sm font-ui group-hover:text-euro-gold transition-colors truncate",
                          isInelegivel ? "text-red-500 font-bold" : "text-[#F5F5F0]"
                        )}>
                          {assessor.nome_assessor}
                        </span>
                        <span className="text-xs font-data text-[#8A8A7A]">
                          {assessor.cod_assessor}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right text-sm font-data text-[#F5F5F0] whitespace-nowrap">
                    {(assessor.latest_custodia / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-sm font-data text-euro-gold font-bold">
                      {assessor.pontos_total.toLocaleString("pt-BR")}
                    </span>
                  </td>
                  <td className="p-4 text-right text-xs font-data text-[#A0A090]">
                    {assessor.pontos_captacao > 0 ? assessor.pontos_captacao.toLocaleString("pt-BR") : "--"}
                  </td>
                  <td className="p-4 text-right text-xs font-data text-[#A0A090] whitespace-nowrap">
                    R$ {(assessor.captacao_liquida_total / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k
                  </td>
                  <td className="p-4 text-right text-xs font-data text-[#A0A090]">
                    {assessor.pontos_roa_invest > 0 ? assessor.pontos_roa_invest.toLocaleString("pt-BR") : "--"}
                  </td>
                  <td className="p-4 text-right text-xs font-data text-[#A0A090]">
                    {assessor.pontos_roa_cs > 0 ? assessor.pontos_roa_cs.toLocaleString("pt-BR") : "--"}
                  </td>
                  <td className="p-4 text-right text-xs font-data text-[#A0A090]">
                    {assessor.pontos_ativacoes > 0 ? assessor.pontos_ativacoes.toLocaleString("pt-BR") : "--"}
                  </td>
                  <td className="p-4 text-right text-xs font-data text-[#A0A090]">
                    {assessor.ativacao_300k > 0 ? assessor.ativacao_300k.toLocaleString("pt-BR") : "--"}
                  </td>
                  <td className="p-4 text-right text-xs font-data text-[#A0A090]">
                    {assessor.ativacao_1kk > 0 ? assessor.ativacao_1kk.toLocaleString("pt-BR") : "--"}
                  </td>
                  <td className="p-4 text-right text-xs font-data text-[#A0A090]">
                    {assessor.pontos_lider > 0 ? assessor.pontos_lider.toLocaleString("pt-BR") : "--"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {rankingData.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-sm font-data text-white/20 uppercase tracking-[0.2em]">
            Nenhum dado encontrado para os filtros selecionados
          </p>
        </div>
      )}
    </div>
  );
}
