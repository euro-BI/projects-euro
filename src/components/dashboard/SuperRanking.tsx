
import React, { useMemo, useState } from "react";
import { AssessorResumo } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { 
  Trophy, 
  Medal, 
  Crown, 
  ArrowUp, 
  ArrowDown, 
  Minus,
  Calendar,
  Filter,
  Users,
  User
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";

const BLOCKED_TEAMS = ["ANYWHERE", "OPERACIONAIS"];
const BLOCKED_ASSESSORS = ["A1607", "A20680", "A39869", "A50655", "A26969"];

interface SuperRankingProps {
  data: AssessorResumo[];
  selectedYear: string;
  onAssessorClick?: (assessor: AssessorResumo) => void;
}

type PeriodType = "year" | "s1" | "s2" | "month";

export default function SuperRanking({ data, selectedYear, onAssessorClick }: SuperRankingProps) {
  const [periodType, setPeriodType] = useState<PeriodType>("year");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Get available months for the year
  const availableMonths = useMemo(() => {
    const validData = data.filter(d => d.data_posicao);
    const months = Array.from(new Set(validData.map(d => format(parseISO(d.data_posicao), "yyyy-MM")))).sort();
    return months.filter(m => m.startsWith(selectedYear));
  }, [data, selectedYear]);

  // Aggregate and filter data based on selected period
  const rankingData = useMemo(() => {
    if (!data.length) return [];

    let filtered = data.filter(d => {
      // Basic data validation
      if (!d.data_posicao || !d.nome_assessor || d.nome_assessor.trim().length === 0 || d.nome_assessor.toLowerCase() === "null" || d.nome_assessor.toLowerCase() === "undefined") return false;
      
      // Filter out blocked teams and assessors
      if (d.time && BLOCKED_TEAMS.includes(d.time)) return false;
      if (d.cod_assessor && BLOCKED_ASSESSORS.includes(d.cod_assessor)) return false;
      
      // Filter by selected year
      return getYear(parseISO(d.data_posicao)).toString() === selectedYear;
    });

    if (periodType === "s1") {
      filtered = filtered.filter(d => getMonth(parseISO(d.data_posicao)) < 6);
    } else if (periodType === "s2") {
      filtered = filtered.filter(d => getMonth(parseISO(d.data_posicao)) >= 6);
    } else if (periodType === "month" && selectedMonth !== "all") {
      filtered = filtered.filter(d => format(parseISO(d.data_posicao), "yyyy-MM") === selectedMonth);
    }

    // Group by assessor and sum points
    const grouped = filtered.reduce((acc: Record<string, any>, curr) => {
      const key = curr.cod_assessor || "unknown";
      if (!acc[key]) {
        acc[key] = {
          ...curr,
          pontos_captacao: 0,
          pontos_roa_invest: 0,
          pontos_roa_cs: 0,
          pontos_ativacoes: 0,
          pontos_lider: 0,
          pontos_total: 0,
        };
      }
      
      acc[key].pontos_captacao += curr.pontos_captacao || 0;
      acc[key].pontos_roa_invest += curr.pontos_roa_invest || 0;
      acc[key].pontos_roa_cs += curr.pontos_roa_cs || 0;
      acc[key].pontos_ativacoes += curr.pontos_ativacoes || 0;
      acc[key].pontos_lider += curr.pontos_lider || 0;
      acc[key].pontos_total += curr.pontos_total || 0;
      
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => b.pontos_total - a.pontos_total);
  }, [data, selectedYear, periodType, selectedMonth]);

  const top3 = rankingData.slice(0, 3);
  const others = rankingData.slice(3);

  const renderPodiumItem = (assessor: any, position: number) => {
    if (!assessor) return null;

    const colors = {
      1: "border-euro-gold text-euro-gold shadow-[0_0_50px_rgba(250,192,23,0.25)]",
      2: "border-[#C0C0C0] text-[#C0C0C0] shadow-[0_0_40px_rgba(192,192,192,0.15)]",
      3: "border-[#CD7F32] text-[#CD7F32] shadow-[0_0_30px_rgba(205,127,50,0.15)]"
    };

    const icons = {
      1: <Crown className="w-8 h-8" />,
      2: <Trophy className="w-6 h-6" />,
      3: <Medal className="w-6 h-6" />
    };

    const heights = {
      1: "h-[450px]",
      2: "h-[380px]",
      3: "h-[320px]"
    };

    const order = {
      1: "order-2",
      2: "order-1",
      3: "order-3"
    };

    return (
      <div 
        key={assessor.cod_assessor}
        onClick={() => onAssessorClick?.(assessor)}
        className={cn(
          "flex flex-col items-center justify-end flex-1 transition-all duration-500 hover:scale-105 cursor-pointer group",
          order[position as 1|2|3]
        )}
      >
        {/* Name and Rank */}
        <div className="text-center mb-4 space-y-1">
          <span className={cn("text-sm font-data uppercase tracking-widest font-bold", colors[position as 1|2|3])}>
            {assessor.nome_assessor ? (
              `${assessor.nome_assessor.split(" ")[0]} ${assessor.nome_assessor.split(" ").slice(-1)[0][0]}.`
            ) : "Assessor"}
          </span>
          <div className="flex items-center justify-center gap-2">
            {icons[position as 1|2|3]}
          </div>
        </div>

        {/* Photo with Ring */}
        <div className={cn(
          "relative w-28 h-28 rounded-full bg-euro-inset border-4 overflow-hidden mb-6",
          colors[position as 1|2|3]
        )}>
          {assessor.foto_url ? (
            <img src={assessor.foto_url} alt={assessor.nome_assessor || ""} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-display opacity-20">
              {assessor.nome_assessor ? (
                assessor.nome_assessor.split(" ").map((n: string) => n[0]).join("").slice(0, 2)
              ) : "A"}
            </div>
          )}
        </div>

        {/* Podium Base */}
        <div className={cn(
          "w-full rounded-t-2xl bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border-x border-t border-white/20 flex flex-col items-center p-6 space-y-4",
          heights[position as 1|2|3]
        )}>
          <div className="text-center">
            <span className="text-xs font-data text-[#8A8A7A] uppercase tracking-[0.2em]">Pontos Total</span>
            <div className="text-4xl font-display text-[#F5F5F0] mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{assessor.pontos_total.toLocaleString("pt-BR")}</div>
          </div>

          <div className="w-full space-y-2 pt-4 border-t border-white/10">
            {[
              { label: "Captação", val: assessor.pontos_captacao },
              { label: "ROA Invest", val: assessor.pontos_roa_invest },
              { label: "ROA CS", val: assessor.pontos_roa_cs },
              { label: "Ativação", val: assessor.pontos_ativacoes },
              { label: "Líder", val: assessor.pontos_lider }
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center text-xs font-data uppercase">
                <span className="text-[#8A8A7A]">{item.label}</span>
                <span className="text-[#F5F5F0] font-bold">{item.val > 0 ? item.val : "--"}</span>
              </div>
            ))}
          </div>

          <div className="mt-auto pb-4">
            <div className={cn(
              "w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl font-display",
              colors[position as 1|2|3]
            )}>
              {position}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-12">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-euro-gold/10 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-euro-gold" />
          </div>
          <div>
            <h2 className="text-2xl font-display text-[#F5F5F0] tracking-wide">Super Ranking Eurostock</h2>
            <p className="text-sm font-ui text-[#A0A090]">Elite de assessores e performance consolidada</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl p-2 rounded-lg border border-white/20">
          <Select 
            value={periodType} 
            onValueChange={(val: PeriodType) => {
              setPeriodType(val);
              if (val !== "month") setSelectedMonth("all");
            }}
          >
            <SelectTrigger className="w-[240px] bg-euro-elevated/50 border-white/10 text-xs font-data">
              <Filter className="w-3 h-3 mr-2 text-euro-gold" />
              <SelectValue>
                {periodType === "year" && `Ano de ${selectedYear}`}
                {periodType === "s1" && `1º Semestre de ${selectedYear}`}
                {periodType === "s2" && `2º Semestre de ${selectedYear}`}
                {periodType === "month" && "Por Mês"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-euro-elevated border-white/10 text-white">
              <SelectItem value="year" className="text-xs">Ano Todo</SelectItem>
              <SelectItem value="s1" className="text-xs">1º Semestre</SelectItem>
              <SelectItem value="s2" className="text-xs">2º Semestre</SelectItem>
              <SelectItem value="month" className="text-xs">Por Mês</SelectItem>
            </SelectContent>
          </Select>

          {periodType === "month" && (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[220px] bg-euro-elevated/50 border-white/10 text-xs font-data">
                <Calendar className="w-3 h-3 mr-2 text-euro-gold" />
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent className="bg-euro-elevated border-white/10 text-white">
                {availableMonths.map(m => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {format(parseISO(`${m}-01`), "MMMM yyyy", { locale: ptBR })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
        {/* PODIUM SECTION */}
        <div className="lg:col-span-5 flex gap-4 min-h-[600px] items-end px-4">
          {renderPodiumItem(top3[1], 2)}
          {renderPodiumItem(top3[0], 1)}
          {renderPodiumItem(top3[2], 3)}
        </div>

        {/* TABLE SECTION (TOP 4+) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-data text-[#8A8A7A] uppercase tracking-widest flex items-center gap-2">
              <Users className="w-3 h-3 text-euro-gold" /> Próximos do Ranking
            </span>
            <span className="text-[10px] font-data text-euro-gold/60">{others.length} {others.length === 1 ? "assessor" : "assessores"}</span>
          </div>
          
          <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-euro-card/95 backdrop-blur-md border-b border-white/10">
                  <tr className="text-xs font-data text-[#8A8A7A] uppercase tracking-wider">
                    <th className="p-4 font-normal">#</th>
                    <th className="p-4 font-normal">Assessor</th>
                    <th className="p-4 font-normal text-right">Total</th>
                    <th className="p-4 font-normal text-right hidden xl:table-cell">Captação</th>
                    <th className="p-4 font-normal text-right hidden xl:table-cell">Invest</th>
                    <th className="p-4 font-normal text-right hidden xl:table-cell">CS</th>
                    <th className="p-4 font-normal text-right hidden xl:table-cell">Ativ.</th>
                    <th className="p-4 font-normal text-right hidden xl:table-cell">Líder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {others.map((assessor, idx) => (
                    <tr 
                      key={assessor.cod_assessor}
                      onClick={() => onAssessorClick?.(assessor)}
                      className="group hover:bg-white/[0.05] transition-colors cursor-pointer"
                    >
                      <td className="p-4 text-sm font-data text-[#8A8A7A]">{idx + 4}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-euro-inset border border-white/10 overflow-hidden">
                            {assessor.foto_url ? (
                              <img src={assessor.foto_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] opacity-30">
                                {assessor.nome_assessor ? assessor.nome_assessor[0] : "A"}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-ui text-[#F5F5F0] group-hover:text-euro-gold transition-colors whitespace-nowrap">{assessor.nome_assessor}</span>
                            <span className="text-xs font-data text-[#8A8A7A]">{assessor.cod_assessor}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm font-data text-euro-gold font-bold">
                          {assessor.pontos_total.toLocaleString("pt-BR")}
                        </span>
                      </td>
                      <td className="p-4 text-right text-xs font-data text-[#A0A090] hidden xl:table-cell">
                        {assessor.pontos_captacao > 0 ? assessor.pontos_captacao : "--"}
                      </td>
                      <td className="p-4 text-right text-xs font-data text-[#A0A090] hidden xl:table-cell">
                        {assessor.pontos_roa_invest > 0 ? assessor.pontos_roa_invest : "--"}
                      </td>
                      <td className="p-4 text-right text-xs font-data text-[#A0A090] hidden xl:table-cell">
                        {assessor.pontos_roa_cs > 0 ? assessor.pontos_roa_cs : "--"}
                      </td>
                      <td className="p-4 text-right text-xs font-data text-[#A0A090] hidden xl:table-cell">
                        {assessor.pontos_ativacoes > 0 ? assessor.pontos_ativacoes : "--"}
                      </td>
                      <td className="p-4 text-right text-xs font-data text-[#A0A090] hidden xl:table-cell">
                        {assessor.pontos_lider > 0 ? assessor.pontos_lider : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
