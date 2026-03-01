
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import {
  Trophy,
  Swords,
  TrendingUp,
  Users,
  Wallet,
  Target,
  Medal,
  Crown,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AssessorResumo } from "@/types/dashboard";

// --- Types ---
type ComparisonMode = "assessores" | "times";
type PeriodType = "month" | "average";

interface ComparisonViewProps {
  // O componente é autônomo, mas pode receber props opcionais se necessário no futuro
}

// --- Helpers ---
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
};

// --- Component ---
export default function ComparisonView() {
  // State
  const [mode, setMode] = useState<ComparisonMode>("assessores");
  const [entity1, setEntity1] = useState<string>("");
  const [entity2, setEntity2] = useState<string>("");
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [averageMonths, setAverageMonths] = useState<string>("3");

  // Fetch Filters (Assessors, Teams, Months)
  const { data: filters, isLoading: isLoadingFilters } = useQuery({
    queryKey: ["comparison-filters"],
    queryFn: async () => {
      // Fetch Active Teams
      const { data: activeTeamsData } = await supabase
        .from("dados_times")
        .select("time")
        .eq("status", "ATIVO");
      const activeTeams = new Set(activeTeamsData?.map((t) => t.time) || []);

      // Fetch Assessors and Months from MV
      const { data } = await supabase
        .from("mv_resumo_assessor")
        .select("cod_assessor, nome_assessor, time, data_posicao")
        .order("data_posicao", { ascending: false });

      if (!data) return { assessors: [], teams: [], months: [] };

      // Process Months
      const months = Array.from(new Set(data.map((d) => d.data_posicao))).sort(
        (a, b) => b.localeCompare(a)
      );

      // Process Assessors (Unique)
      const assessorMap = new Map();
      data.forEach((d) => {
        if (d.cod_assessor && d.nome_assessor && !assessorMap.has(d.cod_assessor)) {
          assessorMap.set(d.cod_assessor, {
            id: d.cod_assessor,
            name: d.nome_assessor,
            team: d.time,
          });
        }
      });
      const assessors = Array.from(assessorMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      // Process Teams (from Active Teams + MV occurrences)
      const teams = Array.from(activeTeams).sort();

      return { assessors, teams, months };
    },
  });

  // Set default month
  React.useEffect(() => {
    if (filters?.months?.length && !selectedMonth) {
      setSelectedMonth(filters.months[0]);
    }
  }, [filters, selectedMonth]);

  // Fetch Comparison Data
  const { data: comparisonData, isLoading: isLoadingData } = useQuery({
    queryKey: [
      "comparison-data",
      mode,
      entity1,
      entity2,
      periodType,
      selectedMonth,
      averageMonths,
    ],
    enabled: !!entity1 && !!entity2 && (!!selectedMonth || periodType === "average"),
    queryFn: async () => {
      let teamPhotosMap = new Map<string, string>();
      
      // Fetch active teams photos if mode is times
      if (mode === "times") {
        const { data: teamsData } = await supabase
          .from("dados_times")
          .select("time, foto_url");
          
        teamsData?.forEach((t) => {
          if (t.time && t.foto_url) {
            teamPhotosMap.set(t.time, t.foto_url);
          }
        });
      }

      let dateFilter: { start: string; end: string };

      if (periodType === "month") {
        dateFilter = { start: selectedMonth, end: selectedMonth };
      } else {
        // Average logic
        const end = selectedMonth || filters?.months[0] || new Date().toISOString();
        const start = format(
          subMonths(parseISO(end), parseInt(averageMonths) - 1),
          "yyyy-MM-01"
        );
        dateFilter = { start, end };
      }

      const query = supabase
        .from("mv_resumo_assessor")
        .select("*")
        .gte("data_posicao", dateFilter.start)
        .lte("data_posicao", dateFilter.end);

      if (mode === "assessores") {
        query.in("cod_assessor", [entity1, entity2]);
      } else {
        query.in("time", [entity1, entity2]);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Aggregation Logic
      const aggregate = (entityId: string, isTeam: boolean) => {
        const records = data.filter((d) =>
          isTeam ? d.time === entityId : d.cod_assessor === entityId
        );

        if (!records.length) return null;

        // Sum metrics
        const summed = records.reduce(
          (acc, curr) => ({
            ...acc,
            receita_total: (acc.receita_total || 0) + (curr.receita_total || 0),
            custodia_net: (acc.custodia_net || 0) + (curr.custodia_net || 0),
            captacao_liquida_total:
              (acc.captacao_liquida_total || 0) + (curr.captacao_liquida_total || 0),
            total_clientes:
              periodType === "month"
                ? curr.total_clientes // Use latest for month
                : (acc.total_clientes || 0) + curr.total_clientes, // Sum for average calculation later
            
            // Products
            receita_renda_fixa: (acc.receita_renda_fixa || 0) + (curr.receita_renda_fixa || 0),
            receita_b3: (acc.receita_b3 || 0) + (curr.receita_b3 || 0),
            receitas_ofertas_fundos: (acc.receitas_ofertas_fundos || 0) + (curr.receitas_ofertas_fundos || 0),
            receita_seguros: (acc.receita_seguros || 0) + (curr.receita_seguros || 0),
            receita_previdencia: (acc.receita_previdencia || 0) + (curr.receita_previdencia || 0),
            receita_consorcios: (acc.receita_consorcios || 0) + (curr.receita_consorcios || 0),
            receitas_offshore: (acc.receitas_offshore || 0) + (curr.receitas_offshore || 0),
            
            // Points
            pontos_total: (acc.pontos_total || 0) + (curr.pontos_total || 0),
          }),
          {} as Partial<AssessorResumo>
        );

        const count = periodType === "average" ? records.length : 1;
        
        // If team, we might need to aggregate differently (sum of all assessors in team for that month)
        // But MV usually has one row per assessor per month.
        // If mode is Team, we filtered by 'time'.
        // Wait, 'mv_resumo_assessor' is per assessor. To get team data, we sum all assessors of that team.
        // But for "Average of X months", we sum everything and divide by X?
        // Or sum everything and divide by (X * number of assessors)?
        // Usually "Average Month Performance".
        
        // Let's simplify: 
        // 1. Group by Month first (to get Team Totals per month)
        // 2. Then Average over months.
        
        // Actually, let's just take the raw sum and divide by number of months (count) if average.
        // If mode is Team, we are summing all assessors in that team.
        // This might be tricky. Let's stick to simple Average per Month.

        const divisor = count || 1; // Avoid div by zero

        // Identification
        const id = isTeam ? entityId : records[0].nome_assessor;
        const subLabel = isTeam ? "Time" : records[0].time;
        const photo = isTeam ? null : records[0].foto_url; // We'd need team photos separate

        return {
          id,
          subLabel,
          photo,
          receita_total: summed.receita_total! / divisor,
          custodia_net: summed.custodia_net! / divisor,
          captacao_liquida: summed.captacao_liquida_total! / divisor,
          pontos: summed.pontos_total! / divisor,
          clientes: periodType === "month" 
            ? (isTeam ? summed.total_clientes : summed.total_clientes) // For team in a month, it's sum of assessors. For average?
            : (summed.total_clientes! / divisor), // Average clients per month
          
          products: {
            "Renda Fixa": summed.receita_renda_fixa! / divisor,
            "Renda Variável": summed.receita_b3! / divisor,
            "Fundos": summed.receitas_ofertas_fundos! / divisor,
            "Seguros": summed.receita_seguros! / divisor,
            "Previdência": summed.receita_previdencia! / divisor,
            "Consórcios": summed.receita_consorcios! / divisor,
            "Offshore": summed.receitas_offshore! / divisor,
          }
        };
      };

      // Need to handle Team aggregation carefully
      // If mode == 'times', we fetch all rows for that team.
      // Then we need to group by month to get "Monthly Total", then average those monthly totals.
      
      const processEntity = (id: string) => {
        const entityRecords = data.filter(d => mode === "times" ? d.time === id : d.cod_assessor === id);
        if (!entityRecords.length) return null;

        // Unique months in dataset for this entity
        const months = new Set(entityRecords.map(r => r.data_posicao)).size;
        const divisor = periodType === "average" ? (months || 1) : 1;

        const totalReceita = entityRecords.reduce((a, b) => a + (b.receita_total || 0), 0);
        const totalCustodia = entityRecords.reduce((a, b) => a + (b.custodia_net || 0), 0);
        const totalCaptacao = entityRecords.reduce((a, b) => a + (b.captacao_liquida_total || 0), 0);
        
        // Products
        const prodRF = entityRecords.reduce((a, b) => a + (b.receita_renda_fixa || 0), 0);
        const prodRV = entityRecords.reduce((a, b) => a + (b.receita_b3 || 0), 0);
        const prodFundos = entityRecords.reduce((a, b) => a + (b.receitas_ofertas_fundos || 0), 0);
        const prodSeguros = entityRecords.reduce((a, b) => a + (b.receita_seguros || 0), 0);
        const prodPrev = entityRecords.reduce((a, b) => a + (b.receita_previdencia || 0), 0);
        const prodCons = entityRecords.reduce((a, b) => a + (b.receita_consorcios || 0), 0);
        const prodOff = entityRecords.reduce((a, b) => a + (b.receitas_offshore || 0), 0);

        // Name/Photo
        let name = id;
        let sub = mode === "times" ? "Time" : "";
        let photo = null;

        if (mode === "assessores") {
          const first = entityRecords[0];
          name = first.nome_assessor;
          sub = first.time;
          photo = first.foto_url;
        } else {
          // Mode is times, try to get photo from map
          photo = teamPhotosMap.get(id) || null;
        }

        // Clientes is snapshot, so average snapshot if average, or sum of snapshots if team?
        // If team: Sum of clients of all assessors in that month.
        // Let's simplify: Sum of 'total_clientes' / months
        // Note: 'total_clientes' in MV is per assessor.
        const totalClientesSum = entityRecords.reduce((a, b) => a + (b.total_clientes || 0), 0);
        
        return {
          id,
          name,
          subLabel: sub,
          photo,
          metrics: {
            receita: totalReceita / divisor,
            custodia: totalCustodia / divisor, // Custody is also snapshot-ish, but usually we treat as avg volume maintained? Or just snapshot avg.
            captacao: totalCaptacao / divisor,
            clientes: totalClientesSum / divisor, // This might be slightly off for teams (summing clients across months then dividing), but acceptable proxy for "Average Active Clients"
            roa: totalCustodia > 0 ? (totalReceita / totalCustodia) * 100 : 0 // Recalculated ROA
          },
          products: [
            { subject: "Renda Fixa", A: prodRF / divisor, fullMark: 150 },
            { subject: "Renda Variável", A: prodRV / divisor, fullMark: 150 },
            { subject: "Fundos", A: prodFundos / divisor, fullMark: 150 },
            { subject: "Seguros", A: prodSeguros / divisor, fullMark: 150 },
            { subject: "Previdência", A: prodPrev / divisor, fullMark: 150 },
            { subject: "Consórcios", A: prodCons / divisor, fullMark: 150 },
            { subject: "Offshore", A: prodOff / divisor, fullMark: 150 },
          ]
        };
      };

      const p1 = processEntity(entity1);
      const p2 = processEntity(entity2);

      return { p1, p2 };
    },
  });

  // Descriptive Analysis Generation
  const analysis = useMemo(() => {
    if (!comparisonData?.p1 || !comparisonData?.p2) return null;
    const { p1, p2 } = comparisonData;

    const winnerRevenue = p1.metrics.receita > p2.metrics.receita ? p1.name : p2.name;
    const winnerGap = Math.abs(p1.metrics.receita - p2.metrics.receita);
    const winnerGapPercent = (winnerGap / Math.min(p1.metrics.receita, p2.metrics.receita)) * 100;

    const winnerCap = p1.metrics.captacao > p2.metrics.captacao ? p1.name : p2.name;
    
    // Find strongest product for each
    const p1Strongest = [...p1.products].sort((a, b) => b.A - a.A)[0];
    const p2Strongest = [...p2.products].sort((a, b) => b.A - a.A)[0];

    return {
      title: `${winnerRevenue} lidera em Receita`,
      description: `Com uma vantagem de ${formatCurrency(winnerGap)} (+${winnerGapPercent.toFixed(1)}%), ${winnerRevenue} domina o volume financeiro.`,
      details: `${p1.name} tem seu ponto forte em ${p1Strongest.subject} (${formatCurrency(p1Strongest.A)}), enquanto ${p2.name} se destaca em ${p2Strongest.subject} (${formatCurrency(p2Strongest.A)}). Na captação líquida, a vitória vai para ${winnerCap}.`
    };
  }, [comparisonData]);

  // Combine product data for charts
  const chartData = useMemo(() => {
    if (!comparisonData?.p1 || !comparisonData?.p2) return [];
    return comparisonData.p1.products.map((p, i) => ({
      subject: p.subject,
      [comparisonData.p1!.name]: p.A,
      [comparisonData.p2!.name]: comparisonData.p2!.products[i].A,
    }));
  }, [comparisonData]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER / CONTROLS */}
      <Card className="bg-euro-card/40 backdrop-blur-md border-white/10">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            
            {/* MODE */}
            <div className="space-y-2">
              <label className="text-xs font-data text-white/60 uppercase">Modo</label>
              <Select value={mode} onValueChange={(v: any) => {
                setMode(v);
                setEntity1("");
                setEntity2("");
              }}>
                <SelectTrigger className="bg-euro-elevated border-white/10 text-white font-data">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-euro-elevated border-white/10 text-white">
                  <SelectItem value="assessores">Comparar Assessores</SelectItem>
                  <SelectItem value="times">Comparar Times</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* PLAYER 1 */}
            <div className="space-y-2">
              <label className="text-xs font-data text-euro-gold/80 uppercase">Desafiante 1</label>
              <Select value={entity1} onValueChange={setEntity1}>
                <SelectTrigger className="bg-euro-elevated border-euro-gold/20 text-white font-data">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-euro-elevated border-white/10 text-white max-h-[300px]">
                  {mode === "assessores" 
                    ? filters?.assessors.filter(a => a.id !== entity2).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)
                    : filters?.teams.filter(t => t !== entity2).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>

            {/* VS */}
            <div className="flex justify-center pb-2">
              <div className="w-10 h-10 rounded-full bg-euro-gold flex items-center justify-center shadow-[0_0_15px_rgba(250,192,23,0.4)]">
                <Swords className="w-5 h-5 text-euro-navy" />
              </div>
            </div>

            {/* PLAYER 2 */}
            <div className="space-y-2">
              <label className="text-xs font-data text-blue-400/80 uppercase">Desafiante 2</label>
              <Select value={entity2} onValueChange={setEntity2}>
                <SelectTrigger className="bg-euro-elevated border-blue-500/20 text-white font-data">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-euro-elevated border-white/10 text-white max-h-[300px]">
                  {mode === "assessores" 
                    ? filters?.assessors.filter(a => a.id !== entity1).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)
                    : filters?.teams.filter(t => t !== entity1).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>

            {/* PERIOD */}
            <div className="space-y-2">
              <label className="text-xs font-data text-white/60 uppercase">Período</label>
              <div className="flex gap-2">
                <Select value={periodType} onValueChange={(v: any) => setPeriodType(v)}>
                  <SelectTrigger className="bg-euro-elevated border-white/10 text-white font-data w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-euro-elevated border-white/10 text-white">
                    <SelectItem value="month">Mês</SelectItem>
                    <SelectItem value="average">Média</SelectItem>
                  </SelectContent>
                </Select>
                
                {periodType === "month" ? (
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="bg-euro-elevated border-white/10 text-white font-data flex-1">
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent className="bg-euro-elevated border-white/10 text-white max-h-[300px]">
                      {filters?.months.map(m => (
                        <SelectItem key={m} value={m}>{format(parseISO(m), "MMM yyyy", { locale: ptBR })}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={averageMonths} onValueChange={setAverageMonths}>
                    <SelectTrigger className="bg-euro-elevated border-white/10 text-white font-data flex-1">
                      <SelectValue placeholder="Qtd" />
                    </SelectTrigger>
                    <SelectContent className="bg-euro-elevated border-white/10 text-white">
                      <SelectItem value="3">3 Meses</SelectItem>
                      <SelectItem value="6">6 Meses</SelectItem>
                      <SelectItem value="12">12 Meses</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BATTLE ARENA */}
      {comparisonData?.p1 && comparisonData?.p2 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT PLAYER CARD */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <Card className="bg-gradient-to-br from-euro-gold/10 to-transparent border-euro-gold/30 h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Crown className="w-32 h-32" />
              </div>
              <CardContent className="flex flex-col items-center pt-8 gap-4 relative z-10">
                <Avatar className="w-32 h-32 border-4 border-euro-gold shadow-[0_0_20px_rgba(250,192,23,0.3)]">
                  <AvatarImage src={comparisonData.p1.photo || ""} />
                  <AvatarFallback className="bg-euro-gold text-euro-navy text-2xl font-bold">
                    {comparisonData.p1.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h2 className="text-2xl font-display text-white">{comparisonData.p1.name}</h2>
                  <p className="text-sm font-data text-euro-gold uppercase tracking-wider">{comparisonData.p1.subLabel}</p>
                </div>
                
                <div className="w-full space-y-4 mt-6">
                  <div className="flex flex-col items-center justify-center py-2 border-b border-white/10 mb-4">
                     <span className="text-xs font-data text-euro-gold uppercase tracking-widest mb-1">Power Level</span>
                     <span className="text-3xl font-display text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                       {Math.round(comparisonData.p1.metrics.receita / 1000).toLocaleString()}
                     </span>
                  </div>
                  <MetricRow label="Receita" value={comparisonData.p1.metrics.receita} isCurrency highlight />
                  <MetricRow label="Captação" value={comparisonData.p1.metrics.captacao} isCurrency />
                  <MetricRow label="Custódia" value={comparisonData.p1.metrics.custodia} isCurrency compact />
                  <MetricRow label="ROA" value={comparisonData.p1.metrics.roa} isPercent />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CENTER STATS & CHARTS */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* ANALYSIS BOX */}
            {analysis && (
              <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-display text-euro-gold flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    {analysis.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-white/90 font-ui leading-relaxed">
                    {analysis.description} {analysis.details}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* RADAR CHART */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-md min-h-[400px]">
              <CardContent className="p-4 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#E8E8E0', fontSize: 13, fontFamily: 'Rajdhani', fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                    <Radar
                      name={comparisonData.p1.name}
                      dataKey={comparisonData.p1.name}
                      stroke="#FAC017"
                      fill="#FAC017"
                      fillOpacity={0.3}
                    />
                    <Radar
                      name={comparisonData.p2.name}
                      dataKey={comparisonData.p2.name}
                      stroke="#60A5FA"
                      fill="#60A5FA"
                      fillOpacity={0.3}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'Rajdhani', fontSize: '12px' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* COMPARATIVE BARS */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-md">
              <CardContent className="pt-6 space-y-6">
                <h3 className="text-base font-data text-white/60 uppercase tracking-wider text-center">Comparativo de Produtos (%)</h3>
                {comparisonData.p1.products.map((prod, i) => {
                  const v1 = prod.A;
                  const v2 = comparisonData.p2!.products[i].A;
                  const total = v1 + v2;
                  const p1Percent = total > 0 ? (v1 / total) * 100 : 50;
                  
                  return (
                    <div key={prod.subject} className="space-y-2">
                      <div className="flex justify-between text-xs font-data text-white/90 uppercase tracking-wider">
                        <span className="font-semibold text-base">{prod.subject}</span>
                      </div>
                      <div className="flex items-center gap-3 h-8">
                        <div className="text-lg font-display text-euro-gold w-20 text-right font-bold">{formatPercent(p1Percent)}</div>
                        <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden flex shadow-inner">
                          <div style={{ width: `${p1Percent}%` }} className="bg-euro-gold h-full shadow-[0_0_10px_rgba(250,192,23,0.4)]" />
                          <div style={{ width: `${100 - p1Percent}%` }} className="bg-blue-400 h-full shadow-[0_0_10px_rgba(96,165,250,0.4)]" />
                        </div>
                        <div className="text-lg font-display text-blue-400 w-20 text-left font-bold">{formatPercent(100 - p1Percent)}</div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

          </div>

          {/* RIGHT PLAYER CARD */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <Card className="bg-gradient-to-bl from-blue-500/10 to-transparent border-blue-500/30 h-full relative overflow-hidden">
              <div className="absolute top-0 left-0 p-4 opacity-10">
                <Target className="w-32 h-32" />
              </div>
              <CardContent className="flex flex-col items-center pt-8 gap-4 relative z-10">
                <Avatar className="w-32 h-32 border-4 border-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.3)]">
                  <AvatarImage src={comparisonData.p2.photo || ""} />
                  <AvatarFallback className="bg-blue-400 text-euro-navy text-2xl font-bold">
                    {comparisonData.p2.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h2 className="text-2xl font-display text-white">{comparisonData.p2.name}</h2>
                  <p className="text-sm font-data text-blue-400 uppercase tracking-wider">{comparisonData.p2.subLabel}</p>
                </div>
                
                <div className="w-full space-y-4 mt-6">
                  <div className="flex flex-col items-center justify-center py-2 border-b border-blue-500/30 mb-4">
                     <span className="text-xs font-data text-blue-400 uppercase tracking-widest mb-1">Power Level</span>
                     <span className="text-3xl font-display text-white drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]">
                       {Math.round(comparisonData.p2.metrics.pontos || comparisonData.p2.metrics.receita / 1000).toLocaleString()}
                     </span>
                  </div>

                  <MetricRow label="Receita" value={comparisonData.p2.metrics.receita} isCurrency color="text-blue-400" />
                  <MetricRow label="Captação" value={comparisonData.p2.metrics.captacao} isCurrency color="text-blue-400" />
                  <MetricRow label="Custódia" value={comparisonData.p2.metrics.custodia} isCurrency compact color="text-blue-400" />
                  <MetricRow label="ROA" value={comparisonData.p2.metrics.roa} isPercent color="text-blue-400" />
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      ) : (
        <div className="min-h-[400px] flex flex-col items-center justify-center text-white/30 space-y-4 border border-dashed border-white/10 rounded-2xl">
          {isLoadingData ? (
            <Skeleton className="w-full h-full bg-white/5" />
          ) : (
            <>
              <Swords className="w-16 h-16 opacity-50" />
              <p className="font-data uppercase tracking-widest text-sm">Selecione os competidores para iniciar a batalha</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-component for metric rows
function MetricRow({ label, value, isCurrency = false, isPercent = false, compact = false, highlight = false, color = "text-euro-gold" }: any) {
  return (
    <div className={cn(
      "flex justify-between items-end border-b border-white/5 pb-2",
      compact ? "opacity-70" : ""
    )}>
      <span className="text-xs font-data text-white/60 uppercase tracking-wider">{label}</span>
      <span className={cn(
        "font-display text-white",
        compact ? "text-sm" : "text-xl",
        highlight ? "scale-110 origin-right" : "",
        color
      )}>
        {isCurrency ? formatCurrency(value) : isPercent ? `${value.toFixed(2)}%` : value}
      </span>
    </div>
  );
}
