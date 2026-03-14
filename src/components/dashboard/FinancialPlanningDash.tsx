import React, { useMemo, useState } from "react";
import { AssessorResumo } from "@/types/dashboard";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine,
  ComposedChart,
  Line
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  Target, 
  TrendingUp, 
  Users, 
  User, 
  AlertCircle,
  CheckCircle2,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

interface FinancialPlanningProps {
  currentData: AssessorResumo[];
  yearlyData: AssessorResumo[];
  selectedYear: string;
  selectedMonth: string;
  teamPhotos?: Map<string, string>;
}

export default function FinancialPlanningDash({ currentData, yearlyData, selectedYear, selectedMonth, teamPhotos }: FinancialPlanningProps) {
  
  // 1. KPI Consolidation (Current Month)
  const kpis = useMemo(() => {
    const total = currentData.reduce((acc, curr) => acc + (curr.total_fp_300k || 0), 0);
    const meta = currentData.reduce((acc, curr) => acc + (curr.meta_fp300k || 0), 0);
    const percent = meta > 0 ? (total / meta) * 100 : 0;
    const gap = meta - total;

    // Calcular quantos assessores bateram a meta
    const achievers = currentData.filter(d => (d.total_fp_300k || 0) >= (d.meta_fp300k || 0) && (d.meta_fp300k || 0) > 0).length;
    const totalAssessors = currentData.filter(d => (d.meta_fp300k || 0) > 0).length;

    return { total, meta, percent, gap, achievers, totalAssessors };
  }, [currentData]);

  // 2. Trend Analysis (Yearly Data)
  const trendData = useMemo(() => {
    // Group by month
    const grouped = yearlyData.reduce((acc: Record<string, any>, curr) => {
      const monthKey = format(parseISO(curr.data_posicao), "yyyy-MM");
      if (!acc[monthKey]) {
        acc[monthKey] = { 
          monthKey, 
          monthName: format(parseISO(curr.data_posicao), "MMM yy", { locale: ptBR }),
          total: 0, 
          meta: 0 
        };
      }
      acc[monthKey].total += curr.total_fp_300k || 0;
      acc[monthKey].meta += curr.meta_fp300k || 0;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a: any, b: any) => a.monthKey.localeCompare(b.monthKey))
      .map((d: any) => ({
        ...d,
        percent: d.meta > 0 ? (d.total / d.meta) * 100 : 0
      }));
  }, [yearlyData]);

  // 3. Team Analysis
  const teamData = useMemo(() => {
    const grouped = currentData.reduce((acc: Record<string, any>, curr) => {
      const team = curr.time || "Outros";
      if (!acc[team]) {
        acc[team] = { name: team, total: 0, meta: 0, assessors: 0 };
      }
      acc[team].total += curr.total_fp_300k || 0;
      acc[team].meta += curr.meta_fp300k || 0;
      acc[team].assessors += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .map((d: any) => ({
        ...d,
        percent: d.meta > 0 ? (d.total / d.meta) * 100 : 0
      }))
      .sort((a: any, b: any) => b.percent - a.percent);
  }, [currentData]);

  // 4. Assessor Analysis (Top & Bottom)
  const assessorData = useMemo(() => {
    return currentData
      .filter(d => (d.meta_fp300k || 0) > 0) // Only show those with targets
      .map(d => ({
        name: d.nome_assessor,
        photo: d.foto_url,
        team: d.time,
        total: d.total_fp_300k || 0,
        meta: d.meta_fp300k || 0,
        percent: (d.meta_fp300k || 0) > 0 ? ((d.total_fp_300k || 0) / d.meta_fp300k) * 100 : 0
      }))
      .sort((a, b) => b.percent - a.percent);
  }, [currentData]);

  // Helper for color based on performance
  const getStatusColor = (percent: number) => {
    if (percent >= 80) return "#22C55E"; // Green
    if (percent >= 50) return "#FAC017"; // Yellow
    return "#EF4444"; // Red
  };


  return (
    <div className="space-y-8">
      {/* SECTION 1: MANCHETE & KPI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: GAUGE CHART (The "Hero" Visual) */}
        <Card className="lg:col-span-4 bg-[#11141D] border-white/10 p-6 relative overflow-hidden group flex flex-col">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Target className="w-24 h-24 text-euro-gold" />
          </div>
          
          <div className="mb-2 relative z-10">
            <h3 className="text-sm font-data text-euro-gold/80 uppercase tracking-widest flex items-center gap-2">
              <Target className="w-4 h-4" />
              Cobertura da Meta
            </h3>
            <p className="text-xs text-white/40 mt-1">Status consolidado de FP 300k+</p>
          </div>

          <div className="flex-1 relative flex items-center justify-center min-h-[200px]">
            <div className="relative w-48 h-48 flex items-center justify-center">
              {/* Circular Progress Background */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="12"
                />
                <motion.circle
                  cx="96"
                  cy="96"
                  r="88"
                  fill="none"
                  stroke={getStatusColor(kpis.percent)}
                  strokeWidth="12"
                  strokeDasharray={2 * Math.PI * 88}
                  initial={{ strokeDashoffset: 2 * Math.PI * 88 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 88 * (1 - Math.min(kpis.percent, 100) / 100) }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-display font-bold" style={{ color: getStatusColor(kpis.percent) }}>
                  {kpis.percent.toFixed(1)}%
                </span>
                <span className="text-xs text-white/40 font-data uppercase tracking-wider mt-1">Atingimento</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-auto pt-6 border-t border-white/5 relative z-10">
            <div className="text-center border-r border-white/5">
              <p className="text-[10px] font-data text-white/30 uppercase tracking-widest mb-1">TOTAL REALIZADO</p>
              <p className="text-2xl font-display text-white">{kpis.total}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-data text-white/30 uppercase tracking-widest mb-1">Meta Total</p>
              <p className="text-2xl font-display text-white">{kpis.meta}</p>
            </div>
          </div>
        </Card>

        {/* CENTER: TREND CHART */}
        <Card className="lg:col-span-5 bg-[#11141D]/80 backdrop-blur-md border-white/10 p-6 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-sm font-data text-white uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-euro-gold" />
                Evolução da Entrega
              </h3>
              <p className="text-xs text-white/40 mt-1">Histórico de Meta vs. Realizado (Últimos 12 Meses)</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-data">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-euro-gold rounded-full" /> Realizado
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-white/20 rounded-full" /> Meta
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FAC017" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#FAC017" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="monthName" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'JetBrains Mono' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'JetBrains Mono' }} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#1A2030', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: '#FAC017', fontFamily: 'JetBrains Mono', fontSize: '12px' }}
                />
                <Bar 
                  dataKey="total" 
                  name="Realizado" 
                  fill="url(#barGradient)" 
                  radius={[4, 4, 0, 0]} 
                  barSize={20}
                />
                <Line 
                  type="monotone" 
                  dataKey="meta" 
                  name="Meta" 
                  stroke="#FFFFFF" 
                  strokeOpacity={0.3} 
                  strokeWidth={2} 
                  dot={{ r: 3, fill: '#1A2030', stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* RIGHT: QUICK STATS */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <Card className="flex-1 bg-euro-elevated border-white/10 p-5 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute right-0 top-0 p-3 opacity-5">
              <Briefcase className="w-16 h-16 text-white" />
            </div>
            <span className="text-xs font-data text-white uppercase tracking-widest font-bold">Gap de Cobertura</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-display text-white">{kpis.gap}</span>
              <span className="text-sm text-white/60">clientes</span>
            </div>
            <div className="w-full bg-white/5 h-1 mt-3 rounded-full overflow-hidden">
              <div className="h-full bg-white/20 w-[60%]" />
            </div>
            <p className="text-xs text-white/60 mt-2 font-medium">Necessário para atingir 100% da meta</p>
          </Card>

          <Card className="flex-1 bg-euro-elevated border-white/10 p-5 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute right-0 top-0 p-3 opacity-5">
              <Users className="w-16 h-16 text-euro-gold" />
            </div>
            <span className="text-xs font-data text-white uppercase tracking-widest font-bold">Assessores na Meta</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-display text-euro-gold">{kpis.achievers}</span>
              <span className="text-base font-data text-white/60">/ {kpis.totalAssessors}</span>
            </div>
            <p className="text-xs text-white/60 mt-2 font-medium">
              {((kpis.achievers / kpis.totalAssessors) * 100).toFixed(1)}% do time comercial atingiu o alvo
            </p>
          </Card>
        </div>
      </div>

      {/* SECTION 2: TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* TEAM TABLE */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-data text-white uppercase tracking-widest flex items-center gap-2">
              <Users className="w-4 h-4 text-euro-gold" />
              Performance por Time
            </h3>
          </div>
          <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-euro-card/95 backdrop-blur-md border-b border-white/10">
                <tr className="text-[10px] sm:text-xs font-data text-white/50 uppercase tracking-wider">
                  <th className="p-4 font-normal">Time</th>
                  <th className="p-4 font-normal text-right">Meta</th>
                  <th className="p-4 font-normal text-right">Realizado</th>
                  <th className="p-4 font-normal text-right">Atingimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {teamData.map((team) => (
                  <tr key={team.name} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-euro-inset border border-white/10 flex items-center justify-center text-[10px] text-white/40 font-data overflow-hidden">
                          {teamPhotos?.has(team.name.toUpperCase()) ? (
                            <img 
                              src={teamPhotos.get(team.name.toUpperCase())} 
                              alt={team.name} 
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            team.name.substring(0, 2)
                          )}
                        </div>
                        {/* No mobile, esconder o nome do time para ganhar espaço */}
                        <span className="hidden sm:inline text-xs sm:text-sm font-ui text-white group-hover:text-euro-gold transition-colors">
                          {team.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right text-xs sm:text-sm font-data text-white">{team.meta}</td>
                    <td className="p-4 text-right text-xs sm:text-sm font-data text-white">{team.total}</td>
                    <td className="pl-4 pr-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={cn(
                          "text-xs sm:text-sm font-data font-bold whitespace-nowrap",
                          team.percent >= 100 ? "text-green-500" : team.percent >= 80 ? "text-euro-gold" : "text-red-500"
                        )}>
                          {team.percent.toFixed(1)}%
                        </span>
                        {/* Progress Bar */}
                        <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden ml-2 hidden sm:block">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              team.percent >= 100
                                ? "bg-green-500"
                                : team.percent >= 80
                                ? "bg-euro-gold"
                                : "bg-red-500"
                            )} 
                            style={{ width: `${Math.min(team.percent, 100)}%` }} 
                          />
                        </div>
                        {team.percent >= 100 ? <CheckCircle2 className="w-3 h-3 text-green-500 ml-1" /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ASSESSOR TABLE */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-data text-white uppercase tracking-widest flex items-center gap-2">
              <User className="w-4 h-4 text-euro-gold" />
              Ranking de Assessores (FP 300k+)
            </h3>
          </div>
          <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl max-h-[500px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-euro-card/95 backdrop-blur-md border-b border-white/10">
                <tr className="text-[10px] sm:text-xs font-data text-white/50 uppercase tracking-wider">
                  <th className="p-4 font-normal">Assessor</th>
                  <th className="p-4 font-normal text-right">Meta</th>
                  <th className="p-4 font-normal text-right">Realizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assessorData.map((assessor, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {/* Nome completo do assessor, mesma fonte em todas as versões e sem foto */}
                        <span className="text-sm font-ui text-white group-hover:text-euro-gold transition-colors truncate">
                          {assessor.name || ""}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right text-xs sm:text-sm font-data text-white">{assessor.meta}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        <span className="text-xs sm:text-sm font-data text-white">
                          {assessor.total}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] sm:text-xs font-data",
                            assessor.percent >= 100
                              ? "text-green-500"
                              : assessor.percent >= 80
                              ? "text-euro-gold"
                              : "text-red-500"
                          )}
                        >
                          ({assessor.percent.toFixed(1)}%)
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
