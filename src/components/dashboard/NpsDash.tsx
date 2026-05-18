import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, endOfMonth, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import {
  Heart,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Star,
  ChevronDown,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  User,
  Shield,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Cell,
  Tooltip as RechartsTooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { NpsDetailsDialog, NpsRow } from "@/components/dashboard/NpsDetailsDialog";
import { AssessorResumo } from "@/types/dashboard";

interface NpsDashProps {
  selectedYear: string;
  selectedMonth: string;
  targetAssessors: string[];
  assessorDetails?: AssessorResumo[];
  teamPhotos?: Map<string, string>;
}

const META_NPS = 90;
const MIN_AMOSTRAS = 3;

export default function NpsDash({
  selectedYear,
  selectedMonth,
  targetAssessors,
  assessorDetails,
  teamPhotos,
}: NpsDashProps) {
  const [tableSearch, setTableSearch] = useState("");
  const [tableSort, setTableSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'statusValue', direction: 'desc' });

  // ─── KPI query (current month) ───────────────────────────────────────────
  const { data: npsData, isLoading } = useQuery({
    queryKey: ["nps-dash-data", selectedMonth, targetAssessors],
    enabled: !!selectedMonth,
    queryFn: async () => {
      const startDate = selectedMonth;
      const endDate = format(endOfMonth(parseISO(selectedMonth)), "yyyy-MM-dd");

      let query = supabase
        .from("vw_nps_tratado" as any)
        .select("*")
        .gte("data_real", startDate)
        .lte("data_real", endDate);

      if (targetAssessors.length > 0) {
        query = query.in("assessor", targetAssessors);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  // ─── Chart query (12 months rolling from selected month) ──────────────────
  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ["nps-chart", selectedMonth, targetAssessors],
    enabled: !!selectedMonth,
    queryFn: async () => {
      const baseDate = parseISO(selectedMonth);
      const months: { key: string; label: string; start: string; end: string }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(baseDate, i);
        const start = format(startOfMonth(d), "yyyy-MM-dd");
        const end = format(endOfMonth(d), "yyyy-MM-dd");
        const key = format(d, "yyyy-MM");
        const label = format(d, "MMM/yy", { locale: ptBR });
        months.push({ key, label, start, end });
      }

      const results = await Promise.all(
        months.map(async (m) => {
          let q = supabase
            .from("vw_nps_tratado" as any)
            .select("status, nota_score, classificacao_nps")
            .gte("data_real", m.start)
            .lte("data_real", m.end);
            
          if (targetAssessors.length > 0) q = q.in("assessor", targetAssessors);
          
          const { data } = await q;
          
          if (!data || data.length === 0) return { month: m.label, monthKey: m.key, score: 0, valid: false };
          
          const respondidos = data.filter(r => r.status === "Finished" && r.nota_score !== null);
          if (respondidos.length === 0) return { month: m.label, monthKey: m.key, score: 0, valid: false };
          
          const promotores = respondidos.filter(r => r.classificacao_nps === "Promotor").length;
          const detratores = respondidos.filter(r => r.classificacao_nps === "Detrator").length;
          const totalRespostas = respondidos.length;
          const score = Math.round(((promotores - detratores) / totalRespostas) * 100);
          
          return { month: m.label, monthKey: m.key, score, valid: totalRespostas >= MIN_AMOSTRAS };
        })
      );

      return results;
    },
  });

  const metrics = useMemo(() => {
    if (!npsData || npsData.length === 0) return null;
    
    const respondidos = npsData.filter(r => r.status === "Finished" && r.nota_score !== null);
    const promotores = respondidos.filter(r => r.classificacao_nps === "Promotor").length;
    const passivos   = respondidos.filter(r => r.classificacao_nps === "Passivo").length;
    const detratores = respondidos.filter(r => r.classificacao_nps === "Detrator").length;
    const totalRespostas = respondidos.length;
    const score = totalRespostas > 0 ? Math.round(((promotores - detratores) / totalRespostas) * 100) : 0;
    const amostrageSuficiente = totalRespostas >= MIN_AMOSTRAS;
    const atingido = amostrageSuficiente && score >= META_NPS;
    
    return { score, promotores, passivos, detratores, totalRespostas, amostrageSuficiente, atingido, respondidos };
  }, [npsData]);

  // Agrupar por assessor
  const assessorData = useMemo(() => {
    if (!metrics || !metrics.respondidos) return [];
    
    const agg = new Map<string, any>();
    
    metrics.respondidos.forEach(r => {
      const cod = r.assessor || "Desconhecido";
      if (!agg.has(cod)) {
        agg.set(cod, { cod_assessor: cod, promotores: 0, passivos: 0, detratores: 0, total: 0 });
      }
      const entry = agg.get(cod);
      entry.total += 1;
      if (r.classificacao_nps === "Promotor") entry.promotores += 1;
      else if (r.classificacao_nps === "Passivo") entry.passivos += 1;
      else if (r.classificacao_nps === "Detrator") entry.detratores += 1;
    });
    
    const rows = Array.from(agg.values()).map(r => {
      const score = Math.round(((r.promotores - r.detratores) / r.total) * 100);
      const details = assessorDetails?.find(a => a.cod_assessor === r.cod_assessor);
      const suficiente = r.total >= MIN_AMOSTRAS;
      const atingido = suficiente && score >= META_NPS;
      
      let statusValue = 1;
      if (atingido) statusValue = 3;
      else if (suficiente) statusValue = 2;

      return {
        ...r,
        score,
        suficiente,
        atingido,
        statusValue,
        nome_assessor: details?.nome_assessor || r.cod_assessor,
        time: details?.time || "N/A",
        foto_url: details?.foto_url,
        lider: details?.lider,
        cluster: details?.cluster || "N/A",
      };
    });
    
    return rows;
  }, [metrics, assessorDetails]);

  const sortedAssessorData = useMemo(() => {
    let result = [...assessorData];
    if (tableSearch) {
      result = result.filter(r => 
        r.cod_assessor.toLowerCase().includes(tableSearch.toLowerCase()) || 
        (r.nome_assessor && r.nome_assessor.toLowerCase().includes(tableSearch.toLowerCase()))
      );
    }
    
    result.sort((a, b) => {
      let aVal = a[tableSort.key];
      let bVal = b[tableSort.key];
      
      if (aVal < bVal) return tableSort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return tableSort.direction === 'asc' ? 1 : -1;
      
      if (a.total !== b.total) {
        return b.total - a.total;
      }
      return 0;
    });
    
    return result;
  }, [assessorData, tableSearch, tableSort]);

  if (isLoading) {
    return (
      <div className="relative min-h-[400px]">
        <LoadingOverlay isLoading={true} />
      </div>
    );
  }

  const m = metrics || {
    score: 0,
    promotores: 0,
    passivos: 0,
    detratores: 0,
    totalRespostas: 0,
    amostrageSuficiente: false,
    atingido: false,
    respondidos: []
  };

  const selectedMonthKey = selectedMonth?.substring(0, 7) ?? "";

  return (
    <div className="space-y-6">
      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Score Card */}
        <Card className={cn(
          "col-span-2 md:col-span-1 bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col h-full",
          m.totalRespostas === 0 ? "opacity-70" : ""
        )}>
          <div className={cn(
            "absolute top-0 left-0 w-1 h-full opacity-50",
            !m.amostrageSuficiente ? "bg-amber-400" : m.atingido ? "bg-emerald-400" : "bg-rose-400"
          )} />
          <CardHeader className="pb-1 pt-4 pl-5 pr-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] font-data text-white/60 uppercase tracking-widest leading-tight">
              Score NPS
            </CardTitle>
            <div className={cn(
              "w-7 h-7 rounded-xl flex items-center justify-center shrink-0",
              !m.amostrageSuficiente ? "bg-amber-400/20" : m.atingido ? "bg-emerald-400/20" : "bg-rose-400/20"
            )}>
              <Heart className={cn(
                "w-3.5 h-3.5",
                !m.amostrageSuficiente ? "text-amber-400" : m.atingido ? "text-emerald-400" : "text-rose-400"
              )} />
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4 pl-5 pr-3 flex-grow flex flex-col items-center justify-center">
            <div className="flex flex-col items-center py-2 mt-1">
              <span className={cn(
                "text-4xl md:text-5xl font-display leading-tight",
                !m.amostrageSuficiente ? "text-amber-400" : m.atingido ? "text-emerald-400" : "text-rose-400"
              )}>
                {m.totalRespostas > 0 ? m.score : "—"}
              </span>
              <span className="text-[10px] font-data uppercase tracking-wider text-white/40 mt-1">
                Meta ≥ {META_NPS}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total Respostas */}
        <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col h-full">
          <div className="absolute top-0 left-0 w-1 h-full opacity-50 bg-blue-400" />
          <CardHeader className="pb-1 pt-4 pl-5 pr-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] font-data text-white/60 uppercase tracking-widest leading-tight">
              Respostas
            </CardTitle>
            <NpsDetailsDialog 
              data={npsData as NpsRow[]}
              selectedMonth={selectedMonth}
              score={m.score}
              promotores={m.promotores}
              passivos={m.passivos}
              detratores={m.detratores}
              totalRespostas={m.totalRespostas}
              atingido={m.atingido}
              metaNps={META_NPS}
              minAmostras={MIN_AMOSTRAS}
            >
              <button className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bg-blue-400/20 hover:bg-blue-400/40 transition-colors cursor-pointer text-blue-400">
                <Search className="w-3.5 h-3.5" />
              </button>
            </NpsDetailsDialog>
          </CardHeader>
          <CardContent className="pt-0 pb-4 pl-5 pr-3 flex-grow flex flex-col items-center justify-center">
            <span className="text-3xl font-display text-[#F5F5F0] leading-tight mt-2">
              {m.totalRespostas}
            </span>
            <span className={cn(
              "text-[10px] font-data uppercase tracking-wider mt-1",
              m.amostrageSuficiente ? "text-emerald-400" : "text-amber-400"
            )}>
              Mínimo {MIN_AMOSTRAS}
            </span>
          </CardContent>
        </Card>

        {/* Promotores */}
        <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col h-full">
          <div className="absolute top-0 left-0 w-1 h-full opacity-50 bg-emerald-500" />
          <CardHeader className="pb-1 pt-4 pl-5 pr-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] font-data text-white/60 uppercase tracking-widest leading-tight">
              Promotores
            </CardTitle>
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4 pl-5 pr-3 flex-grow flex flex-col items-center justify-center">
            <span className="text-3xl font-display text-emerald-400 leading-tight mt-2">
              {m.promotores}
            </span>
            <span className="text-[10px] font-data uppercase tracking-wider text-white/40 mt-1">
              Notas 9-10
            </span>
          </CardContent>
        </Card>

        {/* Passivos */}
        <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col h-full">
          <div className="absolute top-0 left-0 w-1 h-full opacity-50 bg-amber-500" />
          <CardHeader className="pb-1 pt-4 pl-5 pr-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] font-data text-white/60 uppercase tracking-widest leading-tight">
              Passivos
            </CardTitle>
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4 pl-5 pr-3 flex-grow flex flex-col items-center justify-center">
            <span className="text-3xl font-display text-amber-400 leading-tight mt-2">
              {m.passivos}
            </span>
            <span className="text-[10px] font-data uppercase tracking-wider text-white/40 mt-1">
              Notas 7-8
            </span>
          </CardContent>
        </Card>

        {/* Detratores */}
        <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col h-full">
          <div className="absolute top-0 left-0 w-1 h-full opacity-50 bg-rose-500" />
          <CardHeader className="pb-1 pt-4 pl-5 pr-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] font-data text-white/60 uppercase tracking-widest leading-tight">
              Detratores
            </CardTitle>
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bg-rose-500/20">
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4 pl-5 pr-3 flex-grow flex flex-col items-center justify-center">
            <span className="text-3xl font-display text-rose-400 leading-tight mt-2">
              {m.detratores}
            </span>
            <span className="text-[10px] font-data uppercase tracking-wider text-white/40 mt-1">
              Notas 0-6
            </span>
          </CardContent>
        </Card>
      </div>

      {/* ── Chart & Table Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico de Evolução */}
        <Card className="lg:col-span-1 bg-gradient-to-b from-white/[0.06] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <CardHeader className="pb-2 pt-5 px-6 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-data text-white uppercase tracking-wider flex items-center gap-2">
                <Star className="w-4 h-4 text-euro-gold" /> Evolução NPS
              </CardTitle>
              <p className="text-xs font-ui text-white/40 mt-0.5">
                Últimos 12 meses
              </p>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-2 flex-grow flex items-end">
            {isChartLoading ? (
              <div className="relative h-64 w-full flex items-center justify-center">
                <LoadingOverlay isLoading={true} />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={chartData ?? []}
                  margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: "var(--font-data, monospace)" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    domain={[0, 100]}
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: "var(--font-data, monospace)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: "#0F1520", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", fontSize: "12px", fontFamily: "var(--font-data, monospace)" }}
                    formatter={(value: any, name: any, props: any) => [
                      props.payload.valid ? value : "Amostra Insuficiente", 
                      "Score"
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#FBBF24" 
                    strokeWidth={3}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const isSelected = payload.monthKey === selectedMonthKey;
                      if (!payload.valid) return <circle cx={cx} cy={cy} r={4} fill="#64748B" stroke="#0F1520" strokeWidth={2} />;
                      return <circle cx={cx} cy={cy} r={isSelected ? 6 : 4} fill={isSelected ? "#FBBF24" : "#10B981"} stroke="#0F1520" strokeWidth={2} />;
                    }}
                    activeDot={{ r: 6, fill: "#FBBF24", stroke: "#0F1520", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tabela por assessor */}
        <div className="lg:col-span-2 bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative flex flex-col">
          <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />

          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-6 pt-5 pb-4">
            <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase flex items-center gap-2">
              <Users className="w-5 h-5" /> NPS por Assessor
            </h3>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-euro-gold transition-colors" />
                <Input
                  type="text"
                  placeholder="Buscar assessor..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-white/30 focus:border-euro-gold/50 transition-all h-9 text-sm"
                />
              </div>
              <Button
                onClick={() => {
                  const rows = sortedAssessorData.map(r => ({
                    "Assessor": r.cod_assessor,
                    "Score": r.score,
                    "Respostas": r.total,
                    "Promotores": r.promotores,
                    "Passivos": r.passivos,
                    "Detratores": r.detratores,
                    "Válido": r.suficiente ? "Sim" : "Não (Amostra < 3)",
                    "Atingiu Meta": r.atingido ? "Sim" : "Não"
                  }));
                  const worksheet = XLSX.utils.json_to_sheet(rows);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, "NPS_Assessores");
                  XLSX.writeFile(workbook, `nps_assessores_${selectedMonthKey}.xlsx`);
                }}
                className="bg-euro-gold hover:bg-euro-gold/80 text-euro-navy font-bold h-9 gap-2 px-4 shadow-lg shadow-euro-gold/10 shrink-0"
              >
                <Download className="w-4 h-4" />
                XLSX
              </Button>
            </div>
          </div>

          <div className="overflow-auto flex-grow relative min-h-[300px] max-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-30">
                <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                  <th
                    onClick={() => setTableSort(p => ({ key: 'time', direction: p.key === 'time' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 bg-euro-gold z-40 w-[80px] min-w-[80px] max-w-[80px] cursor-pointer hover:bg-euro-gold/80 transition-colors hidden md:table-cell"
                  >
                    <div className="flex items-center gap-2">Time {tableSort.key === 'time' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3 ml-auto" /> : <ArrowDown className="w-3 h-3 ml-auto" />) : <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />}</div>
                  </th>
                  <th
                    onClick={() => setTableSort(p => ({ key: 'nome_assessor', direction: p.key === 'nome_assessor' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 md:left-[80px] bg-euro-gold z-40 min-w-[220px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">Assessor {tableSort.key === 'nome_assessor' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3 ml-auto" /> : <ArrowDown className="w-3 h-3 ml-auto" />) : <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />}</div>
                  </th>
                  <th
                    onClick={() => setTableSort(p => ({ key: 'score', direction: p.key === 'score' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-center cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-2">Score {tableSort.key === 'score' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                  <th
                    onClick={() => setTableSort(p => ({ key: 'total', direction: p.key === 'total' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-center cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-2">Respostas {tableSort.key === 'total' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                  <th
                    onClick={() => setTableSort(p => ({ key: 'promotores', direction: p.key === 'promotores' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-center cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-2">P {tableSort.key === 'promotores' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                  <th
                    onClick={() => setTableSort(p => ({ key: 'passivos', direction: p.key === 'passivos' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-center cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-2">Pa {tableSort.key === 'passivos' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                  <th
                    onClick={() => setTableSort(p => ({ key: 'detratores', direction: p.key === 'detratores' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-center cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-2">D {tableSort.key === 'detratores' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                  <th
                    onClick={() => setTableSort(p => ({ key: 'statusValue', direction: p.key === 'statusValue' && p.direction === 'desc' ? 'asc' : 'desc' }))}
                    className="py-4 px-4 font-bold text-center cursor-pointer hover:bg-euro-gold/80 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-2">Status {tableSort.key === 'statusValue' ? (tableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-20" />}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {sortedAssessorData.length > 0 ? (
                  sortedAssessorData.map((r, idx) => (
                    <tr key={r.cod_assessor} className="group hover:bg-white/[0.05] transition-colors">
                      {/* Time */}
                      <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10 w-[80px] min-w-[80px] max-w-[80px] hidden md:table-cell">
                        <div className="flex items-center justify-center">
                          {r.time && teamPhotos?.has(r.time.toUpperCase()) ? (
                            <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                              <img 
                                src={teamPhotos.get(r.time.toUpperCase())} 
                                alt={r.time} 
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold">
                              {r.time?.substring(0, 3).toUpperCase() || "N/A"}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Assessor */}
                      <td className="py-3 px-4 border-r border-white/10 sticky left-0 md:left-[80px] bg-euro-navy group-hover:bg-[#1e2538] z-10">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <div className={cn(
                              "w-10 h-10 rounded-full bg-euro-inset flex items-center justify-center text-xs font-bold text-euro-gold/40 border border-white/10 overflow-hidden group-hover:border-euro-gold transition-colors",
                              r.lider && "border-euro-gold shadow-[0_0_12px_rgba(250,192,23,0.3)]"
                            )}>
                              {r.foto_url ? (
                                <img src={r.foto_url} alt={r.nome_assessor} className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-5 h-5 opacity-20" />
                              )}
                            </div>
                            {r.lider && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-euro-gold rounded-full flex items-center justify-center shadow-lg">
                                <Shield className="w-2 h-2 text-euro-navy" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-white font-bold truncate group-hover:text-euro-gold transition-colors uppercase tracking-tight">
                              {r.nome_assessor}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-white/90 font-medium">
                              <span className="font-mono">{r.cod_assessor}</span>
                              <span className="text-white/40">•</span>
                              <span className="uppercase">{r.cluster}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={cn(
                          "text-lg font-display font-bold",
                          !r.suficiente ? "text-amber-400" : r.atingido ? "text-emerald-400" : "text-rose-400"
                        )}>
                          {r.score}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-data text-white">{r.total}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-data text-emerald-400">{r.promotores}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-data text-amber-400">{r.passivos}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-data text-rose-400">{r.detratores}</span>
                      </td>
                      <td className="p-4 text-center">
                        {!r.suficiente ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-data text-amber-400 px-2 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3" /> Amostra &lt; {MIN_AMOSTRAS}
                          </span>
                        ) : r.atingido ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-data text-emerald-400 px-2 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3" /> Atingiu Meta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-data text-rose-400 px-2 py-1 rounded-full bg-rose-400/10 border border-rose-400/20 whitespace-nowrap">
                            <XCircle className="w-3 h-3" /> Abaixo da Meta
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center opacity-30">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-8 h-8" />
                        <span className="text-xs font-data uppercase tracking-widest">Nenhum assessor com nota encontrada</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
