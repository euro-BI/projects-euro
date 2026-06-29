import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { ArrowLeft, LayoutDashboard, Maximize2, Minimize2, MessageSquareText, Sparkles } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { ImpactfulBackground } from "@/components/dashboard/ImpactfulBackground";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import { SmartChat } from "@/components/SmartChat";
import { CockpitV2Sidebar } from "@/components/cockpit-v2/CockpitV2Sidebar";
import { CockpitV2Hero } from "@/components/cockpit-v2/CockpitV2Hero";
import { CockpitV2FundingPulse } from "@/components/cockpit-v2/CockpitV2FundingPulse";
import { CockpitV2KpiRail } from "@/components/cockpit-v2/CockpitV2KpiRail";
import { CockpitV2PerformanceSection } from "@/components/cockpit-v2/CockpitV2PerformanceSection";
import { CockpitV2CaptureAnalysis } from "@/components/cockpit-v2/CockpitV2CaptureAnalysis";
import { CockpitV2RevenueChart } from "@/components/cockpit-v2/CockpitV2RevenueChart";
import { CockpitV2IndicatorsTable } from "@/components/cockpit-v2/CockpitV2IndicatorsTable";
import { useAssessorCockpitV2Data } from "@/hooks/useAssessorCockpitV2Data";
import { RevenueViewKey, buildCaptureAnalysisData, buildRevenueChartData } from "@/utils/cockpit-v2-mappers";

export default function AssessorCockpitV2() {
  const navigate = useNavigate();
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [selectedRevenueView, setSelectedRevenueView] = useState<RevenueViewKey>("total");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const {
    userRole,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    selectedTeam,
    setSelectedTeam,
    selectedAssessorCode,
    setSelectedAssessorCode,
    displayMode,
    setDisplayMode,
    filteredMonths,
    filtersData,
    rankingSummary,
    kpis,
    topMetrics,
    hero,
    tableRows,
    yearlyData,
    isLoading,
  } = useAssessorCockpitV2Data();

  const chartData = useMemo(() => buildRevenueChartData(yearlyData, selectedRevenueView), [selectedRevenueView, yearlyData]);
  const captureAnalysisData = useMemo(() => buildCaptureAnalysisData(yearlyData), [yearlyData]);

  const handleToggleMaximize = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsMaximized(true);
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsMaximized(false);
      }
    } catch {
      setIsMaximized((prev) => !prev);
    }
  };

  const handleNavigateSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleExport = () => {
    if (!tableRows.length) return;
    const exportRows = tableRows.map((row) => ({
      Time: row.team,
      Assessor: row.assessor,
      Codigo: row.code,
      Custodia: row.netClientes,
      MetaCaptacao: row.metaCaptacao,
      CaptacaoLiquida: row.captacaoLiquida,
      MetaReceita: row.metaReceita,
      ReceitaTotal: row.receitaTotal,
      ReceitaInvest: row.receitaInvest,
      ReceitaCS: row.receitaCs,
      ROATotal: row.roaTotal,
      Ativacao300k: row.ativacao300k,
      RepasseTotal: row.repasseTotal,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "MeuCockpitV2");
    XLSX.writeFile(workbook, `meu_cockpit_v2_${selectedYear}_${selectedMonth || "periodo"}.xlsx`);
  };

  return (
    <PageLayout className={`bg-transparent px-4 pb-10 text-[#E8E8E0] transition-all duration-500 ${isMaximized ? "pt-4 sm:pt-8" : "pt-20 sm:pt-24"}`}>
      <LoadingOverlay isLoading={isLoading} message="Carregando Meu Cockpit..." />
      <ImpactfulBackground opacity={0.35} />

      <div className="mx-auto flex max-w-[1700px] gap-6">
        <CockpitV2Sidebar
          activeSection={activeSection}
          onNavigate={handleNavigateSection}
          advisorPhoto={hero.photo}
          advisorName={hero.assessorName}
          isAssessorFiltered={selectedAssessorCode !== "all"}
        />

        <div className="relative z-10 flex-1 space-y-6">
          <div id="top" className="flex flex-col gap-4 scroll-mt-28 rounded-[30px] border border-white/10 bg-[#0B1019]/85 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/dash")}
                    className="h-10 rounded-full border border-white/10 bg-white/5 px-4 text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-euro-gold/20 bg-euro-gold/10 text-euro-gold">
                    <LayoutDashboard className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <h1 className="font-display text-3xl uppercase tracking-[0.14em] text-white">Meu Cockpit</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">
                    Uma mesa de controle individual para o assessor acompanhar performance, mix de receita, captação, ranking e fechamento do mês em uma única tela.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <DashboardFilters
                  selectedYear={selectedYear}
                  setSelectedYear={setSelectedYear}
                  selectedMonth={selectedMonth}
                  setSelectedMonth={setSelectedMonth}
                  selectedTeam={selectedTeam}
                  setSelectedTeam={setSelectedTeam}
                  selectedAssessorId={selectedAssessorCode}
                  setSelectedAssessorId={setSelectedAssessorCode}
                  filtersData={filtersData}
                  filteredMonths={filteredMonths}
                  userRole={userRole}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleToggleMaximize}
                  className="h-10 w-10 rounded-full border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                >
                  {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: "meta", label: "Meta Original" },
                { key: "proportional", label: "Meta Proporcional" },
                { key: "pace", label: "Projeção Pace" },
              ].map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setDisplayMode(mode.key as "meta" | "proportional" | "pace")}
                  className={`rounded-full px-4 py-2 text-[11px] font-data uppercase tracking-[0.18em] transition-all ${
                    displayMode === mode.key
                      ? "bg-euro-gold text-euro-navy shadow-[0_0_30px_rgba(250,192,23,0.18)]"
                      : "border border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsChatOpen(true)}
              className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(250,192,23,0.12),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.14),_transparent_34%),linear-gradient(180deg,#151C29_0%,#0E1521_100%)] p-5 text-left shadow-[0_24px_80px_rgba(0,0,0,0.28)] transition-all hover:border-euro-gold/25 hover:shadow-[0_28px_90px_rgba(0,0,0,0.34)]"
            >
              <div className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-euro-gold/15 bg-euro-gold/10 text-euro-gold">
                <Sparkles className="h-5 w-5" />
              </div>

              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-[11px] font-data uppercase tracking-[0.22em] text-euro-gold">
                  <MessageSquareText className="h-4 w-4" />
                  IA no cockpit
                </div>
                <h2 className="mt-3 font-display text-2xl uppercase tracking-[0.12em] text-white">
                  Converse com seus dados sem sair da tela
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/55">
                  Abra o agente da Euro dentro do cockpit para perguntar sobre repasse, ROA, net, ranking e leituras do mês. O histórico continua em cache até você limpar.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[10px] font-data uppercase tracking-[0.18em] text-white/55 transition-all group-hover:border-euro-gold/20 group-hover:text-white">
                  Abrir assistente
                </div>
              </div>
            </button>
          </div>

          <CockpitV2Hero hero={hero} rankingSummary={rankingSummary} selectedYear={selectedYear} />
          <div id="funding-focus" className="space-y-6 scroll-mt-28">
            <CockpitV2FundingPulse kpis={kpis} />
            <CockpitV2CaptureAnalysis data={captureAnalysisData} />
          </div>
          <CockpitV2KpiRail metrics={topMetrics} />
          <CockpitV2PerformanceSection kpis={kpis} />
          <CockpitV2RevenueChart data={chartData} selectedView={selectedRevenueView} onChangeView={setSelectedRevenueView} />
          <CockpitV2IndicatorsTable rows={tableRows} onExport={handleExport} />
        </div>
      </div>

      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent hideCloseButton className="border-white/10 bg-[#08101A] p-0 sm:max-w-[min(96vw,1400px)] h-[90vh] overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
          <DialogTitle className="sr-only">Euro Inteligente</DialogTitle>
          <div className="h-full bg-[#0B111A] p-4">
            <SmartChat embedded onRequestClose={() => setIsChatOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
