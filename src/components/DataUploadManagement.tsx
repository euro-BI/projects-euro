import { useMemo, useState, useRef, useEffect, type ButtonHTMLAttributes } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, ExternalLink, Layers, Loader2, RefreshCw, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-11 rounded-2xl border-white/10 bg-white/[0.04] text-[#F4F1E8] placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-euro-gold/40 focus-visible:ring-offset-0";
const dialogClass =
  "gap-5 border-white/10 bg-[#12141A] text-[#F4F1E8] sm:rounded-[28px] p-6 sm:p-8";

const UPLOAD_TYPES = [
  { value: "dados_captacoes", label: "Captações" },
  { value: "positivador", label: "Positivador" },
  { value: "cetipados", label: "Cetipados" },
  { value: "dados_rv_executadas", label: "RV executadas" },
  { value: "dados_transferencias", label: "Transferências" },
  { value: "dados_rf_fluxo", label: "RF fluxo" },
  { value: "dados_pj_custodia", label: "PJ custódia" },
  { value: "dados_offshore_remessas", label: "Offshore remessas" },
  { value: "dados_offshore_operacoes", label: "Offshore operações" },
  { value: "dados_posicao_black", label: "Posição Black" },
  { value: "dados_fundos_novo", label: "Fundos" },
  { value: "dados_diversificador", label: "Diversificador" },
  { value: "dados_rupturas", label: "Rupturas" },
  { value: "dados_fp", label: "Financial Planning" },
  { value: "dados_modelo_servir", label: "Modelo de servir" },
  { value: "dados_habilitacoes", label: "Habilitações" },
  { value: "dados_ativacoes", label: "Ativações" },
  { value: "dados_nps", label: "NPS" },
  { value: "dados_cambio", label: "Câmbio" },
  { value: "dados_demonstrativo_full", label: "Demonstrativo", pending: true },
] as const;

interface TabelaInfo {
  table_name: string;
  ultima_data_registro: string | null;
  ultima_atualizacao: string | null;
  total_registros: number;
}

type UploadProgress = {
  percent: number;
  label: string;
  current?: number;
  total?: number;
};

type FreshnessFilter = "all" | "ok" | "warn" | "stale";
type StatusSortKey = "base" | "ultimo_registro" | "atualizacao" | "registros";

const HUB_RELATORIOS_OPERACOES = "https://hub.xpi.com.br/new/relatorios-de-operacoes#/v2";
const HUB_CUSTODIA_FII = "https://hub.xpi.com.br/new/relatorios/#/custodia-fii";
const HUB_OFFSHORE = "https://hub.xpi.com.br/new/relatorios/#/offshore-digital";
const HUB_RENDA_FIXA = "https://hub.xpi.com.br/new/relatorios/#/renda-fixa";
const HUB_TERMOS = "https://hub.xpi.com.br/new/relatorios/#/relatorios-termos";
const HUB_ESFORCOS = "https://hub.xpi.com.br/new/relatorios/#/indice-esforcos-assessoria";
const HUB_BLACK = "https://black.xpi.com.br/produtos-estruturados/#/relatorios";
const HUB_TRANSFERENCIAS = "https://hub.xpi.com.br/new/transferencia-de-clientes#/";
const HUB_NPS = "https://xpcx.yul1.qualtrics.com/reporting-dashboard/web/69485f0603905a0008e2264f/pages/Page_61f4889e-6209-4a73-beef-c906a1c569c8/view?organizationSSOConfigId=OSC_eXPTFGd8Y1b0bIy&stateID=2e1114c7-33a9-4009-a1e3-a1625159e146";
const HUB_CAMBIO = "https://hub.xpi.com.br/cambio/#/relatorios";
const HUB_GERENCIAIS = "https://hub.xpi.com.br/new/relatorios/#/relatorios-gerencias";

const HUB_LINKS: Record<string, string> = {
  dados_captacoes: HUB_RELATORIOS_OPERACOES,
  dados_positivador: HUB_RELATORIOS_OPERACOES,
  dados_diversificador: HUB_RELATORIOS_OPERACOES,
  dados_diversificador_full: HUB_RELATORIOS_OPERACOES,
  dados_cetipados: HUB_CUSTODIA_FII,
  dados_offshore_remessas: HUB_OFFSHORE,
  dados_offshore_operacoes: HUB_OFFSHORE,
  dados_rf_fluxo: HUB_RENDA_FIXA,
  dados_pj_custodia: HUB_RENDA_FIXA,
  dados_fp: HUB_TERMOS,
  dados_modelo_servir: HUB_ESFORCOS,
  dados_rupturas: HUB_ESFORCOS,
  dados_rv_executadas: HUB_BLACK,
  dados_posicao_black: HUB_BLACK,
  dados_transferencias: HUB_TRANSFERENCIAS,
  dados_nps: HUB_NPS,
  dados_cambio: HUB_CAMBIO,
  dados_demonstrativo_full: HUB_GERENCIAIS,
  dados_habilitacao_ativacao: HUB_GERENCIAIS,
};

export function DataUploadManagement() {
  const { user } = useAuth();

  const [selectedUploadName, setSelectedUploadName] = useState<string>("");
  const [webhookFile, setWebhookFile] = useState<File | null>(null);
  const [isWebhookSending, setIsWebhookSending] = useState(false);
  const [showN8NProgressModal, setShowN8NProgressModal] = useState(false);
  const [n8nResult, setN8nResult] = useState<{ total_linhas_enviadas: number } | null>(null);
  const [n8nError, setN8nError] = useState(false);
  const [n8nErrorMessage, setN8nErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ percent: 0, label: "" });
  const [uploadMeta, setUploadMeta] = useState<{ fileName: string; baseLabel: string }>({ fileName: "", baseLabel: "" });
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [fileLineCount, setFileLineCount] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const webhookFileInputRef = useRef<HTMLInputElement>(null);

  const [tabelasInfo, setTabelasInfo] = useState<TabelaInfo[]>([]);
  const [isLoadingTabelas, setIsLoadingTabelas] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [isRefreshingViews, setIsRefreshingViews] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [refreshErrorMessage, setRefreshErrorMessage] = useState<string | null>(null);
  const [refreshDone, setRefreshDone] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<UploadProgress>({ percent: 0, label: "" });
  const [freshnessFilter, setFreshnessFilter] = useState<FreshnessFilter>("all");
  const [statusSort, setStatusSort] = useState<{ key: StatusSortKey; dir: "asc" | "desc" }>({
    key: "base",
    dir: "asc",
  });

  const freshnessCounts = useMemo(() => {
    const counts = { ok: 0, warn: 0, stale: 0 };
    for (const tabela of tabelasInfo) {
      const bucket = freshnessBucket(tabela.ultima_atualizacao);
      if (bucket === "ok") counts.ok += 1;
      else if (bucket === "warn") counts.warn += 1;
      else if (bucket === "stale") counts.stale += 1;
    }
    return counts;
  }, [tabelasInfo]);

  const displayedTabelas = useMemo(() => {
    const filtered = freshnessFilter === "all"
      ? tabelasInfo
      : tabelasInfo.filter((tabela) => freshnessBucket(tabela.ultima_atualizacao) === freshnessFilter);

    const direction = statusSort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (statusSort.key === "base") {
        return prettyTableName(a.table_name).localeCompare(prettyTableName(b.table_name), "pt-BR") * direction;
      }
      if (statusSort.key === "registros") {
        return (a.total_registros - b.total_registros) * direction;
      }
      const left = statusSort.key === "ultimo_registro" ? a.ultima_data_registro : a.ultima_atualizacao;
      const right = statusSort.key === "ultimo_registro" ? b.ultima_data_registro : b.ultima_atualizacao;
      if (!left && !right) return 0;
      if (!left) return 1;
      if (!right) return -1;
      return left.localeCompare(right) * direction;
    });
  }, [tabelasInfo, freshnessFilter, statusSort]);

  const toggleStatusSort = (key: StatusSortKey) => {
    setStatusSort((current) => (
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "base" ? "asc" : "desc" }
    ));
  };

  const selectFreshnessFilter = (filter: FreshnessFilter) => {
    setFreshnessFilter((current) => (current === filter && filter !== "all" ? "all" : filter));
  };

  const formatDateSafe = (dateString: string | null): string => {
    if (!dateString) return "—";
    if (dateString.includes("-") && dateString.length === 10) {
      const [year, month, day] = dateString.split("-").map(Number);
      return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
    }
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const countFileLines = async (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          const nonEmptyRows = jsonData.filter(
            (row: unknown) => Array.isArray(row) && row.some((cell) => cell !== null && cell !== undefined && cell !== ""),
          );
          resolve(Math.max(0, nonEmptyRows.length - 1));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
      reader.readAsArrayBuffer(file);
    });
  };

  const fetchTabelasInfo = async () => {
    setIsLoadingTabelas(true);
    try {
      const { data, error } = await supabase
        .from("vw_tabelas_atualizacao")
        .select("*")
        .order("table_name", { ascending: true });
      if (error) {
        console.error("Erro ao buscar informações das tabelas:", error);
        return;
      }
      setTabelasInfo(data || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Erro ao buscar informações das tabelas:", error);
    } finally {
      setIsLoadingTabelas(false);
    }
  };

  useEffect(() => {
    fetchTabelasInfo();
  }, []);

  const applyWebhookFile = async (file: File) => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
      ".xlsx",
      ".xls",
      ".csv",
    ];
    const isValidType = validTypes.some((type) => file.type === type || file.name.toLowerCase().endsWith(type));
    if (!isValidType) {
      if (webhookFileInputRef.current) webhookFileInputRef.current.value = "";
      return;
    }

    setWebhookFile(file);
    try {
      setFileLineCount(await countFileLines(file));
    } catch (error) {
      console.error("Erro ao contar linhas do arquivo:", error);
      setFileLineCount(0);
    }
  };

  const handleWebhookFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await applyWebhookFile(file);
  };

  const showConfirmation = () => {
    if (!webhookFile || !selectedUploadName || !user?.id) return;
    const selected = UPLOAD_TYPES.find((item) => item.value === selectedUploadName);
    if (selected && "pending" in selected && selected.pending) return;
    setShowConfirmationModal(true);
  };

  const refreshDashViews = async () => {
    setShowRefreshModal(true);
    setIsRefreshingViews(true);
    setRefreshError(false);
    setRefreshErrorMessage(null);
    setRefreshDone(false);
    setRefreshProgress({ percent: 8, label: "Preparando o recálculo..." });

    const views = [
      { name: "mv_resumo_assessor", label: "Recalculando resumo do assessor..." },
      { name: "mv_detalhamento_ativacoes", label: "Recalculando detalhamento de ativações..." },
    ] as const;

    try {
      for (let i = 0; i < views.length; i += 1) {
        const view = views[i];
        setRefreshProgress({
          percent: i === 0 ? 18 : 58,
          label: view.label,
          current: i,
          total: views.length,
        });
        const stopFake = startCreepingProgress(
          setRefreshProgress,
          i === 0 ? 18 : 58,
          i === 0 ? 52 : 92,
          view.label,
          views.length,
        );
        let data: { error?: string; ok?: boolean } | null = null;
        let error: { message?: string; context?: Response } | null = null;
        try {
          const response = await supabase.functions.invoke("refresh-dash-views", {
            body: { view: view.name },
          });
          data = response.data;
          error = response.error;
        } finally {
          stopFake();
        }
        await throwIfFunctionFailed(error, data);
        setRefreshProgress({
          percent: i === 0 ? 55 : 100,
          label: i === 0 ? "Resumo atualizado. Seguindo para ativações..." : "Visões atualizadas",
          current: i + 1,
          total: views.length,
        });
      }
      setRefreshDone(true);
    } catch (error) {
      console.error("Erro ao atualizar visões:", error);
      setRefreshError(true);
      setRefreshErrorMessage(error instanceof Error ? error.message : "Falha ao atualizar as visões");
      setRefreshDone(false);
    } finally {
      setIsRefreshingViews(false);
    }
  };

  const confirmAndSendWebhook = async () => {
    setShowConfirmationModal(false);
    setIsWebhookSending(true);
    setShowN8NProgressModal(true);
    setN8nResult(null);
    setN8nError(false);
    setN8nErrorMessage(null);
    setUploadMeta({
      fileName: webhookFile?.name ?? "",
      baseLabel: UPLOAD_TYPES.find((item) => item.value === selectedUploadName)?.label || selectedUploadName,
    });
    setUploadProgress({ percent: 6, label: "Lendo o arquivo..." });

    try {
      if (!webhookFile || webhookFile.size === 0) {
        throw new Error("Arquivo inválido ou vazio. Por favor, selecione o arquivo novamente.");
      }

      if (isEdgeUpload(selectedUploadName)) {
        const rows = await parseSpreadsheetRows(webhookFile);
        setUploadProgress({ percent: 14, label: "Preparando a carga...", current: 0, total: rows.length });
        const data = await invokeSelectedEdgeIngest(selectedUploadName, rows, setUploadProgress);
        setUploadProgress({
          percent: 100,
          label: "Carga concluída",
          current: Number(data?.total_linhas_enviadas ?? data?.gravadas ?? rows.length),
          total: rows.length,
        });
        setN8nResult({ total_linhas_enviadas: Number(data?.total_linhas_enviadas ?? data?.gravadas ?? 0) });
        setWebhookFile(null);
        setSelectedUploadName("");
        if (webhookFileInputRef.current) webhookFileInputRef.current.value = "";
        fetchTabelasInfo();
        return;
      }

      let webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/uploads";
      if (selectedUploadName === "dados_fundos_novo") webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/fundos";
      else if (selectedUploadName === "dados_diversificador") webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/diversificador";

      const formData = new FormData();
      const fileExtension = webhookFile.name.split(".").pop();
      formData.append("file", webhookFile, `${selectedUploadName}.${fileExtension}`);
      formData.append("selected_name", selectedUploadName);
      formData.append("user_id", user!.id);

      setUploadProgress({ percent: 18, label: "Enviando para o processador..." });
      const stopFake = startCreepingProgress(setUploadProgress, 18, 84, "Processando no servidor...");
      let response: Response;
      try {
        response = await fetch(webhookUrl, { method: "POST", body: formData });
      } finally {
        stopFake();
      }
      if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
      setUploadProgress({ percent: 92, label: "Recebendo o retorno..." });

      const result = await response.json();
      if (result && result.status === "erro") {
        setN8nError(true);
        setN8nResult(null);
        return;
      }

      let totalLinhas = null;
      if (result && typeof result.total_linhas_enviadas === "number") totalLinhas = result.total_linhas_enviadas;
      else if (result?.data && typeof result.data.total_linhas_enviadas === "number") totalLinhas = result.data.total_linhas_enviadas;
      else if (Array.isArray(result) && typeof result[0]?.total_linhas_enviadas === "number") totalLinhas = result[0].total_linhas_enviadas;
      else if (result?.output && typeof result.output.total_linhas_enviadas === "number") totalLinhas = result.output.total_linhas_enviadas;

      setUploadProgress({ percent: 100, label: "Carga concluída", current: totalLinhas ?? 0, total: fileLineCount || undefined });
      setN8nResult({ total_linhas_enviadas: totalLinhas ?? 0 });
      setWebhookFile(null);
      setSelectedUploadName("");
      if (webhookFileInputRef.current) webhookFileInputRef.current.value = "";
      fetchTabelasInfo();
    } catch (error) {
      console.error("Erro ao enviar webhook:", error);
      setN8nError(true);
      setN8nErrorMessage(error instanceof Error ? error.message : "Falha ao enviar o arquivo");
      setN8nResult(null);
    } finally {
      setIsWebhookSending(false);
    }
  };

  const selectedUpload = UPLOAD_TYPES.find((item) => item.value === selectedUploadName);
  const selectedLabel = selectedUpload?.label || selectedUploadName;
  const selectedPending = Boolean(selectedUpload && "pending" in selectedUpload && selectedUpload.pending);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0 rounded-[28px] border border-white/10 bg-[#12141A] p-5 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)]">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,280px)_1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-white/50">Tipo de carga</Label>
            <Select value={selectedUploadName} onValueChange={setSelectedUploadName}>
              <SelectTrigger className={fieldClass}><SelectValue placeholder="Selecione a base" /></SelectTrigger>
              <SelectContent>
                {UPLOAD_TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {"pending" in item && item.pending ? `${item.label} · ainda falta configurar` : item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-white/50">Arquivo Excel/CSV</Label>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                const file = event.dataTransfer.files?.[0];
                if (file) void applyWebhookFile(file);
              }}
              className={cn("rounded-2xl transition-shadow", isDragging && "ring-1 ring-euro-gold/50")}
            >
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                ref={webhookFileInputRef}
                onChange={handleWebhookFileChange}
                className={cn(fieldClass, "cursor-pointer file:mr-3 file:border-0 file:bg-transparent file:text-sm file:text-white/60")}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={showConfirmation}
            disabled={!webhookFile || !selectedUploadName || isWebhookSending || selectedPending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-euro-gold px-5 text-sm font-semibold text-euro-navy transition-colors hover:bg-euro-gold/90 disabled:pointer-events-none disabled:opacity-35"
          >
            {isWebhookSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isWebhookSending ? "Enviando..." : "Enviar"}
          </button>
        </div>

        {webhookFile && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{webhookFile.name}</span>
            {selectedLabel && <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{selectedLabel}</span>}
            {selectedPending && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/45">Ainda falta configurar</span>
            )}
            <span className="rounded-full border border-euro-gold/20 bg-euro-gold/10 px-3 py-1.5 text-euro-gold">
              {fileLineCount} {fileLineCount === 1 ? "linha" : "linhas"}
            </span>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#12141A] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)]">
        <div className="flex shrink-0 flex-col gap-3 border-b border-white/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white">Status das bases</p>
            <p className="text-xs text-white/35">
              {lastRefresh ? `Lido às ${lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Freshness das cargas"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FreshnessFilterBadge
              active={freshnessFilter === "all"}
              onClick={() => selectFreshnessFilter("all")}
              label={`${tabelasInfo.length} todos`}
            />
            <FreshnessFilterBadge
              active={freshnessFilter === "ok"}
              onClick={() => selectFreshnessFilter("ok")}
              dot="bg-emerald-400"
              label={`${freshnessCounts.ok} em dia`}
            />
            <FreshnessFilterBadge
              active={freshnessFilter === "warn"}
              onClick={() => selectFreshnessFilter("warn")}
              dot="bg-euro-gold"
              label={`${freshnessCounts.warn} atenção`}
            />
            <FreshnessFilterBadge
              active={freshnessFilter === "stale"}
              onClick={() => selectFreshnessFilter("stale")}
              dot="bg-red-400"
              label={`${freshnessCounts.stale} atrasadas`}
            />
            <GhostButton onClick={fetchTabelasInfo} disabled={isLoadingTabelas} className="h-10">
              <RefreshCw className={cn("h-4 w-4", isLoadingTabelas && "animate-spin")} />
              Atualizar
            </GhostButton>
            <button
              type="button"
              onClick={() => void refreshDashViews()}
              disabled={isRefreshingViews || isWebhookSending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-euro-gold px-4 text-sm font-semibold text-euro-navy transition-colors hover:bg-euro-gold/90 disabled:pointer-events-none disabled:opacity-35"
            >
              {isRefreshingViews ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
              Atualizar dashboards
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-white/[0.06] px-5 py-2 md:hidden">
          {([
            ["base", "Base"],
            ["ultimo_registro", "Registro"],
            ["atualizacao", "Atualização"],
            ["registros", "Registros"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleStatusSort(key)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]",
                statusSort.key === key
                  ? "border-white/25 bg-white/[0.1] text-white"
                  : "border-white/10 bg-white/[0.04] text-white/55",
              )}
            >
              {label}
              {statusSort.key === key
                ? statusSort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                : null}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {isLoadingTabelas && tabelasInfo.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-white/40">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando bases...
            </div>
          ) : tabelasInfo.length === 0 ? (
            <p className="px-5 py-16 text-center text-white/40">Nenhuma informação de tabela encontrada.</p>
          ) : displayedTabelas.length === 0 ? (
            <p className="px-5 py-16 text-center text-white/40">Nenhuma base neste filtro.</p>
          ) : (
            <>
              <table className="hidden w-full text-left md:table">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.025] text-[11px] uppercase tracking-wide text-white/40">
                    <StatusSortHeader label="Base" sortKey="base" current={statusSort} onSort={toggleStatusSort} className="px-5" />
                    <StatusSortHeader label="Último registro" sortKey="ultimo_registro" current={statusSort} onSort={toggleStatusSort} />
                    <StatusSortHeader label="Atualização" sortKey="atualizacao" current={statusSort} onSort={toggleStatusSort} />
                    <StatusSortHeader label="Registros" sortKey="registros" current={statusSort} onSort={toggleStatusSort} align="right" className="px-5" />
                    <th className="px-5 py-3.5 text-right font-medium">Hub</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTabelas.map((tabela) => (
                    <tr key={tabela.table_name} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.035]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <FreshnessDot date={tabela.ultima_atualizacao} />
                          <div>
                            <p className="font-medium text-white">{prettyTableName(tabela.table_name)}</p>
                            <p className="font-data text-[11px] text-white/35">{tabela.table_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-data text-sm text-white/75">{formatDateSafe(tabela.ultima_data_registro)}</td>
                      <td className="px-4 py-4 font-data text-sm text-white/75">{formatDateSafe(tabela.ultima_atualizacao)}</td>
                      <td className="px-5 py-4 text-right font-data text-sm tabular-nums text-euro-gold">
                        {tabela.total_registros.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <HubReportLink tableName={tabela.table_name} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="divide-y divide-white/[0.06] md:hidden">
                {displayedTabelas.map((tabela) => (
                  <div key={tabela.table_name} className="flex items-start gap-3 px-5 py-4">
                    <FreshnessDot date={tabela.ultima_atualizacao} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{prettyTableName(tabela.table_name)}</p>
                      <p className="mt-1 text-xs text-white/40">
                        {formatDateSafe(tabela.ultima_atualizacao)} · {tabela.total_registros.toLocaleString("pt-BR")} registros
                      </p>
                    </div>
                    <HubReportLink tableName={tabela.table_name} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={showRefreshModal}
        onOpenChange={isRefreshingViews ? undefined : (open) => {
          if (!open) {
            setShowRefreshModal(false);
            setRefreshError(false);
            setRefreshErrorMessage(null);
            setRefreshDone(false);
            setRefreshProgress({ percent: 0, label: "" });
          }
        }}
      >
        <DialogContent className={cn(dialogClass, "sm:max-w-lg")}>
          <UploadProgressPanel
            sending={isRefreshingViews}
            error={refreshError}
            errorMessage={refreshErrorMessage}
            result={refreshDone ? { total_linhas_enviadas: 2 } : null}
            progress={refreshProgress}
            baseLabel="mv_resumo_assessor · mv_detalhamento_ativacoes"
            variant="views"
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={showN8NProgressModal}
        onOpenChange={isWebhookSending ? undefined : (open) => {
          if (!open) {
            setShowN8NProgressModal(false);
            setN8nError(false);
            setN8nErrorMessage(null);
            setN8nResult(null);
            setUploadProgress({ percent: 0, label: "" });
          }
        }}
      >
        <DialogContent className={cn(dialogClass, "sm:max-w-lg")}>
          <UploadProgressPanel
            sending={isWebhookSending}
            error={n8nError}
            errorMessage={n8nErrorMessage}
            result={n8nResult}
            progress={uploadProgress}
            fileName={uploadMeta.fileName}
            baseLabel={uploadMeta.baseLabel}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmationModal} onOpenChange={setShowConfirmationModal}>
        <DialogContent className={cn(dialogClass, "sm:max-w-md")}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-tight">Confirmar envio</DialogTitle>
            <DialogDescription className="text-white/50">
              Enviar {fileLineCount} {fileLineCount === 1 ? "linha" : "linhas"} para {selectedLabel}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75">
            <p><span className="text-white/40">Arquivo · </span>{webhookFile?.name}</p>
            <p><span className="text-white/40">Base · </span>{selectedLabel}</p>
            <p><span className="text-white/40">Linhas · </span>{fileLineCount}</p>
          </div>
          <div className="flex gap-2">
            <GhostButton className="flex-1" onClick={() => setShowConfirmationModal(false)}>Cancelar</GhostButton>
            <button
              type="button"
              onClick={confirmAndSendWebhook}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-euro-gold px-5 text-sm font-semibold text-euro-navy hover:bg-euro-gold/90"
            >
              <Send className="h-4 w-4" />
              Confirmar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function parseSpreadsheetRows(file: File): Promise<Record<string, unknown>[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null, raw: true });
}

const POSITIVADOR_HEADERS = new Set([
  "assessor",
  "cliente",
  "sexo",
  "data cadastro",
  "data de cadastro",
  "data nascimento",
  "data de nascimento",
  "status",
  "receita bovespa",
  "receita futuros",
  "receita rf bancarios",
  "receita rf privados",
  "receita rf publicos",
  "net em m",
  "tipo pessoa",
  "segmentacao cliente",
  "data posicao",
  "data",
  "data atualizacao",
]);

function normalizeUploadHeader(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function serializeUploadValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return parseUploadDate(value) ?? value;
  }
  return value;
}

function parseUploadDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString("en-CA", { timeZone: "UTC" });
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 20_000 && value < 80_000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000)
      .toLocaleDateString("en-CA", { timeZone: "UTC" });
  }
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return null;
}

function parseUploadPeriod(value: unknown): string | null {
  const date = parseUploadDate(value);
  if (date) return `${date.slice(0, 7)}-01`;
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.round(value);
    if (n >= 200001 && n <= 209912) {
      const year = Math.floor(n / 100);
      const month = n % 100;
      if (month >= 1 && month <= 12) return `${year}-${String(month).padStart(2, "0")}-01`;
    }
  }
  const raw = String(value ?? "").trim();
  const yyyymm = raw.match(/^(\d{4})(\d{2})$/);
  if (yyyymm) {
    const month = Number(yyyymm[2]);
    if (month >= 1 && month <= 12) return `${yyyymm[1]}-${yyyymm[2]}-01`;
  }
  return null;
}

const CETIPADOS_HEADERS = new Set([
  "data",
  "assessor",
  "cliente",
  "conta",
  "fundo",
  "valor",
  "receita estimada",
]);

function slimRowsByHeader(rows: Record<string, unknown>[], headers: Set<string>) {
  return rows.map((row) => {
    const slim: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!headers.has(normalizeUploadHeader(key))) continue;
      slim[key] = serializeUploadValue(value);
    }
    return slim;
  });
}

function slimPositivadorRows(rows: Record<string, unknown>[]) {
  return slimRowsByHeader(rows, POSITIVADOR_HEADERS);
}

function slimCetipadosRows(rows: Record<string, unknown>[]) {
  return slimRowsByHeader(rows, CETIPADOS_HEADERS);
}

const RF_FLUXO_HEADERS = new Set([
  "data",
  "vencimento",
  "ticker",
  "tipo juros",
  "tipo ativo",
  "cod assessor",
  "codigo assessor",
  "cod conta",
  "codigo conta",
  "nome papel",
  "indexador",
  "tipo operacao",
  "volume",
  "receita a dividir",
  "pu cliente",
  "pu tmr",
  "taxa cliente",
  "taxa tmr",
]);

function slimRfFluxoRows(rows: Record<string, unknown>[]) {
  return slimRowsByHeader(rows, RF_FLUXO_HEADERS);
}

const RV_EXECUTADAS_HEADERS = new Set([
  "codigo cliente",
  "operacao",
  "data inclusao",
  "ativo",
  "quantidade",
  "estrutura",
  "fixing",
  "preco de compra da acao",
  "comissao",
  "assessor da operacao",
  "assessor do cliente",
  "envio da ordem",
  "envio ordem",
  "canal de origem",
  "canal origem",
]);

const PJ_CUSTODIA_HEADERS = new Set([
  "dat posicao",
  "data foto custodia",
  "data posicao",
  "vencimento",
  "data vencimento",
  "cod assessor",
  "codigo assessor",
  "assessor",
  "conta",
  "cod conta",
  "receita a dividir",
  "receita acruada a dividir",
]);

function slimRvExecutadasRows(rows: Record<string, unknown>[]) {
  return slimRowsByHeader(rows, RV_EXECUTADAS_HEADERS);
}

function slimPjCustodiaRows(rows: Record<string, unknown>[]) {
  return slimRowsByHeader(rows, PJ_CUSTODIA_HEADERS);
}

const OFFSHORE_REMESSAS_HEADERS = new Set([
  "date",
  "data",
  "data de abertura da conta offshore digital",
  "data abertura conta",
  "valor da ordem de remessa r",
  "valor da ordem de remessa",
  "valor ordem remessa rs",
  "taxa percentual do spread",
  "taxa percentual spread",
  "ordem realizada com o mercado aberto ou fechado",
  "ordem realizada mercado",
  "codigo do assessor",
  "cod assessor",
  "nome da matriz",
  "nome matriz",
  "segmento",
  "canal",
  "identificador unico da ordem cambio",
  "identificador unico da ordem",
  "identificador unico ordem",
]);

const OFFSHORE_OPERACOES_HEADERS = new Set([
  "date",
  "data",
  "codigo da conta brasil",
  "cod conta brasil",
  "data de abertura da conta offshore digital",
  "data abertura conta",
  "volume financeiro operado transacionado",
  "volume financeiro usd",
  "valor da receita gerada",
  "valor receita usd",
  "codigo do assessor",
  "cod assessor",
  "nome da matriz",
  "nome matriz",
  "segmento",
  "canal",
  "identificador unico da ordem operacoes",
  "identificador unico da ordem",
  "identificador unico ordem",
]);

const POSICAO_BLACK_HEADERS = new Set([
  "codigo do cliente",
  "codigo cliente",
  "codigo do assessor",
  "codigo assessor",
  "codigo da operacao",
  "codigo operacao",
  "data registro",
  "ativo",
  "estrutura",
  "canal de origem",
  "canal origem",
  "valor ativo",
  "data vencimento",
  "custo unitario cliente",
  "comissao assessor",
  ...[1, 2, 3, 4].flatMap((n) => [
    `quantidade ativa ${n}`,
    `quantidade boleta ${n}`,
    `tipo ${n}`,
    `do strike ${n}`,
    `strike percentual ${n}`,
    `valor do strike ${n}`,
    `strike valor ${n}`,
    `da barreira ${n}`,
    `barreira percentual ${n}`,
    `valor da barreira ${n}`,
    `barreira valor ${n}`,
    `valor do rebate ${n}`,
    `rebate valor ${n}`,
    `tipo da barreira ${n}`,
    `tipo barreira ${n}`,
  ]),
]);

function slimOffshoreRemessasRows(rows: Record<string, unknown>[]) {
  return slimRowsByHeader(rows, OFFSHORE_REMESSAS_HEADERS);
}

function slimOffshoreOperacoesRows(rows: Record<string, unknown>[]) {
  return slimRowsByHeader(rows, OFFSHORE_OPERACOES_HEADERS);
}

function slimPosicaoBlackRows(rows: Record<string, unknown>[]) {
  return slimRowsByHeader(rows, POSICAO_BLACK_HEADERS);
}

const TRANSFERENCIAS_HEADERS = new Set([
  "codigo do cliente",
  "cod cliente",
  "codigo assessor origem",
  "cod assessor origem",
  "codigo assessor destino",
  "cod assessor destino",
  "data solicitacao",
  "data transferencia",
  "status",
  "codigo solicitacao",
  "cod solicitacao",
]);

function slimTransferenciasRows(rows: Record<string, unknown>[]) {
  return slimRowsByHeader(rows, TRANSFERENCIAS_HEADERS);
}

const RUPTURAS_HEADERS = new Set([
  "ano mes",
  "periodo",
  "cod assessor",
  "cod conta",
  "cod cliente",
  "pontuacao ruptura",
  "pontuacao",
]);

const FP_HEADERS = new Set([
  "mes",
  "ano mes",
  "periodo",
  "cod conta",
  "status da conta",
  "status conta",
  "segmento da conta",
  "segmento conta",
  "segmento comercial",
  "cod assessor",
  "data de criacao fp",
  "data criacao fp",
  "ultima data de atualizacao",
  "ultima atualizacao",
  "completude",
]);

const MODELO_SERVIR_HEADERS = new Set([
  "ano mes",
  "mes",
  "periodo",
  "cod assessor",
  "indice modelo de servir",
]);

const HAB_ATIV_HEADERS = new Set([
  "conta",
  "assessor",
  "cod assessor",
  "data",
  "faixa",
  "conta ativada",
]);

function slimRupturasRows(rows: Record<string, unknown>[]) {
  return slimRowsByHeader(rows, RUPTURAS_HEADERS);
}

function slimFpRows(rows: Record<string, unknown>[]) {
  return slimRowsByHeader(rows, FP_HEADERS);
}

function slimModeloServirRows(rows: Record<string, unknown>[]) {
  return slimRowsByHeader(rows, MODELO_SERVIR_HEADERS);
}

function slimHabAtivRows(rows: Record<string, unknown>[]) {
  return slimRowsByHeader(rows, HAB_ATIV_HEADERS);
}

const CAMBIO_HEADERS = new Set([
  "data",
  "tp pessoa",
  "assessor",
  "receita a dividir",
  "dt mn cli",
  "dt me cli",
]);

function slimCambioRows(rows: Record<string, unknown>[]) {
  return slimRowsByHeader(rows, CAMBIO_HEADERS);
}

const NPS_HEADER_TOKENS = [
  "cod assessor",
  "cod conta",
  "record date",
  "distribution category",
  "survey id",
  "email opened",
  "survey finished time",
  "q1",
  "primeira experiencia",
  "jornada 2 1",
  "jornada 3 2",
];

function slimNpsRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => {
    const slim: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const normalized = normalizeUploadHeader(key);
      if (!NPS_HEADER_TOKENS.some((token) => normalized.includes(token))) continue;
      slim[key] = serializeUploadValue(value);
    }
    return slim;
  });
}

function isEdgeUpload(name: string) {
  return name === "dados_captacoes"
    || name === "positivador"
    || name === "cetipados"
    || name === "dados_rf_fluxo"
    || name === "dados_rv_executadas"
    || name === "dados_pj_custodia"
    || name === "dados_offshore_remessas"
    || name === "dados_offshore_operacoes"
    || name === "dados_posicao_black"
    || name === "dados_transferencias"
    || name === "dados_rupturas"
    || name === "dados_fp"
    || name === "dados_modelo_servir"
    || name === "dados_habilitacoes"
    || name === "dados_ativacoes"
    || name === "dados_cambio"
    || name === "dados_nps";
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

async function throwIfFunctionFailed(error: { message?: string; context?: Response } | null, data: { error?: string; ok?: boolean } | null) {
  if (data?.error || data?.ok === false) {
    throw new Error(data?.error || "Falha ao gravar o arquivo");
  }
  if (!error) return;
  let detail = error.message || "Falha ao gravar o arquivo";
  try {
    const body = await error.context?.json();
    if (body && typeof body === "object" && "error" in body && body.error) {
      detail = String(body.error);
    }
  } catch {
    /* keep default */
  }
  throw new Error(detail);
}

async function invokeIngestCaptacoes(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  onProgress?.({ percent: 28, label: "Enviando captações...", current: 0, total: rows.length });
  const stopFake = startCreepingProgress(onProgress, 28, 88, "Gravando o dia no banco...", rows.length);
  let data: { error?: string; ok?: boolean; gravadas?: number; total_linhas_enviadas?: number } | null = null;
  let error: { message?: string; context?: Response } | null = null;
  try {
    const response = await supabase.functions.invoke("ingest-captacoes", { body: { rows } });
    data = response.data;
    error = response.error;
  } finally {
    stopFake();
  }
  await throwIfFunctionFailed(error, data);
  onProgress?.({
    percent: 100,
    label: "Carga concluída",
    current: Number(data?.gravadas ?? rows.length),
    total: rows.length,
  });
  return data;
}

async function invokeIngestPositivador(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  const slim = slimPositivadorRows(rows);
  const dates = slim
    .map((row) => {
      const raw = row.Data ?? row.data_posicao ?? row["Data Posição"] ?? row["Data Posicao"];
      return parseUploadDate(raw);
    })
    .filter((value): value is string => Boolean(value))
    .sort();
  const dataAtualizacao = dates.at(-1) ?? null;
  const meses = monthsFromIsoDates(dates);
  const chunks = chunkRows(slim, 400);
  let last: Record<string, unknown> | null = null;
  let gravadas = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    const sent = Math.min((i + 1) * 400, slim.length);
    onProgress?.({
      percent: Math.round(18 + (i / chunks.length) * 78),
      label: i === 0 ? "Limpando o mês e gravando o primeiro lote..." : `Gravando lote ${i + 1} de ${chunks.length}...`,
      current: i * 400,
      total: slim.length,
    });
    const { data, error } = await supabase.functions.invoke("ingest-positivador", {
      body: {
        chunked: true,
        rows: chunks[i],
        replace_months: i === 0,
        aplicar_realocacao: i === chunks.length - 1,
        meses_substituir: i === 0 ? meses : [],
        data_atualizacao: dataAtualizacao,
      },
    });
    await throwIfFunctionFailed(error, data);
    gravadas += Number(data?.gravadas ?? 0);
    last = data;
    onProgress?.({
      percent: Math.round(18 + ((i + 1) / chunks.length) * 78),
      label: i === chunks.length - 1 ? "Aplicando regras finais..." : `Lote ${i + 1} de ${chunks.length} gravado`,
      current: sent,
      total: slim.length,
    });
  }

  return { ...last, gravadas, total_linhas_enviadas: gravadas };
}

async function invokeIngestCetipados(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  const slim = slimCetipadosRows(rows);
  const dates = slim
    .map((row) => {
      const raw = row.Data ?? row.data;
      return parseUploadDate(raw);
    })
    .filter((value): value is string => Boolean(value))
    .sort();
  const meses = monthsFromIsoDates(dates);
  const chunks = chunkRows(slim, 400);
  let last: Record<string, unknown> | null = null;
  let gravadas = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    const sent = Math.min((i + 1) * 400, slim.length);
    onProgress?.({
      percent: Math.round(18 + (i / Math.max(chunks.length, 1)) * 78),
      label: i === 0 ? "Limpando o mês e gravando o primeiro lote..." : `Gravando lote ${i + 1} de ${chunks.length}...`,
      current: i * 400,
      total: slim.length,
    });
    const { data, error } = await supabase.functions.invoke("ingest-cetipados", {
      body: {
        chunked: true,
        rows: chunks[i],
        replace_months: i === 0,
        meses_substituir: i === 0 ? meses : [],
      },
    });
    await throwIfFunctionFailed(error, data);
    gravadas += Number(data?.gravadas ?? 0);
    last = data;
    onProgress?.({
      percent: Math.round(18 + ((i + 1) / Math.max(chunks.length, 1)) * 78),
      label: i === chunks.length - 1 ? "Finalizando a carga..." : `Lote ${i + 1} de ${chunks.length} gravado`,
      current: sent,
      total: slim.length,
    });
  }

  return { ...last, gravadas, total_linhas_enviadas: gravadas };
}

async function invokeIngestRfFluxo(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  const slim = slimRfFluxoRows(rows);
  const dates = slim
    .map((row) => {
      const raw = row.Data ?? row.data;
      return parseUploadDate(raw);
    })
    .filter((value): value is string => Boolean(value))
    .sort();
  const meses = monthsFromIsoDates(dates);
  const chunks = chunkRows(slim, 400);
  let last: Record<string, unknown> | null = null;
  let gravadas = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    const sent = Math.min((i + 1) * 400, slim.length);
    onProgress?.({
      percent: Math.round(18 + (i / Math.max(chunks.length, 1)) * 78),
      label: i === 0 ? "Limpando o mês e gravando o primeiro lote..." : `Gravando lote ${i + 1} de ${chunks.length}...`,
      current: i * 400,
      total: slim.length,
    });
    const { data, error } = await supabase.functions.invoke("ingest-rf-fluxo", {
      body: {
        chunked: true,
        rows: chunks[i],
        replace_months: i === 0,
        meses_substituir: i === 0 ? meses : [],
      },
    });
    await throwIfFunctionFailed(error, data);
    gravadas += Number(data?.gravadas ?? 0);
    last = data;
    onProgress?.({
      percent: Math.round(18 + ((i + 1) / Math.max(chunks.length, 1)) * 78),
      label: i === chunks.length - 1 ? "Finalizando a carga..." : `Lote ${i + 1} de ${chunks.length} gravado`,
      current: sent,
      total: slim.length,
    });
  }

  return { ...last, gravadas, total_linhas_enviadas: gravadas };
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value);
}

function monthsFromIsoDates(dates: string[]) {
  return [...new Set(dates.filter(isIsoDate).map((date) => `${date.slice(0, 7)}-01`))];
}

function pickSlimDate(
  row: Record<string, unknown>,
  keys: string[],
  parser: (value: unknown) => string | null = parseUploadDate,
) {
  for (const key of keys) {
    const parsed = parser(row[key]);
    if (parsed) return parsed;
  }
  return null;
}

async function invokeChunkedIngest(
  fn: string,
  slim: Record<string, unknown>[],
  dateKeys: string[],
  onProgress?: (progress: UploadProgress) => void,
  options?: {
    extraBody?: Record<string, unknown>;
    parseDate?: (value: unknown) => string | null;
  },
) {
  const parser = options?.parseDate ?? parseUploadDate;
  const dates = slim.map((row) => pickSlimDate(row, dateKeys, parser)).filter((value): value is string => Boolean(value)).sort();
  const meses = monthsFromIsoDates(dates);
  const chunks = chunkRows(slim, 400);
  let last: Record<string, unknown> | null = null;
  let gravadas = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    const sent = Math.min((i + 1) * 400, slim.length);
    onProgress?.({
      percent: Math.round(18 + (i / Math.max(chunks.length, 1)) * 78),
      label: i === 0 ? "Limpando o mês e gravando o primeiro lote..." : `Gravando lote ${i + 1} de ${chunks.length}...`,
      current: i * 400,
      total: slim.length,
    });
    const { data, error } = await supabase.functions.invoke(fn, {
      body: {
        chunked: true,
        rows: chunks[i],
        replace_months: i === 0,
        meses_substituir: i === 0 ? meses : [],
        ...options?.extraBody,
      },
    });
    await throwIfFunctionFailed(error, data);
    gravadas += Number(data?.gravadas ?? 0);
    last = data;
    onProgress?.({
      percent: Math.round(18 + ((i + 1) / Math.max(chunks.length, 1)) * 78),
      label: i === chunks.length - 1 ? "Finalizando a carga..." : `Lote ${i + 1} de ${chunks.length} gravado`,
      current: sent,
      total: slim.length,
    });
  }

  return { ...last, gravadas, total_linhas_enviadas: gravadas };
}

async function invokeIngestRvExecutadas(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  return invokeChunkedIngest(
    "ingest-rv-executadas",
    slimRvExecutadasRows(rows),
    ["Data Inclusão", "Data Inclusao", "data_inclusao"],
    onProgress,
  );
}

async function invokeIngestPjCustodia(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  return invokeChunkedIngest(
    "ingest-pj-custodia",
    slimPjCustodiaRows(rows),
    ["DAT_POSICAO", "data_foto_custodia", "Data Posicao"],
    onProgress,
  );
}

async function invokeIngestOffshoreRemessas(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  return invokeChunkedIngest(
    "ingest-offshore-remessas",
    slimOffshoreRemessasRows(rows),
    ["Date", "date", "Data"],
    onProgress,
  );
}

async function invokeIngestOffshoreOperacoes(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  return invokeChunkedIngest(
    "ingest-offshore-operacoes",
    slimOffshoreOperacoesRows(rows),
    ["Date", "date", "Data"],
    onProgress,
  );
}

async function invokeIngestPosicaoBlack(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  return invokeChunkedIngest(
    "ingest-posicao-black",
    slimPosicaoBlackRows(rows),
    ["Data Registro", "data_registro"],
    onProgress,
  );
}

async function invokeIngestTransferencias(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  return invokeChunkedIngest(
    "ingest-transferencias",
    slimTransferenciasRows(rows),
    ["Data Transferência", "Data Transferencia", "data_transferencia"],
    onProgress,
  );
}

const PERIODO_KEYS = ["Ano Mês", "Ano Mes", "Mês", "Mes", "periodo"];

async function invokeIngestRupturas(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  return invokeChunkedIngest(
    "ingest-rupturas",
    slimRupturasRows(rows),
    PERIODO_KEYS,
    onProgress,
    { parseDate: parseUploadPeriod },
  );
}

async function invokeIngestFp(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  return invokeChunkedIngest(
    "ingest-fp",
    slimFpRows(rows),
    PERIODO_KEYS,
    onProgress,
    { parseDate: parseUploadPeriod },
  );
}

async function invokeIngestModeloServir(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  return invokeChunkedIngest(
    "ingest-modelo-servir",
    slimModeloServirRows(rows),
    PERIODO_KEYS,
    onProgress,
    { parseDate: parseUploadPeriod },
  );
}

async function invokeIngestHabAtiv(
  fonte: "habilitacao" | "ativacao",
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  return invokeChunkedIngest(
    "ingest-habilitacao-ativacao",
    slimHabAtivRows(rows),
    ["Data", "data"],
    onProgress,
    { extraBody: { fonte } },
  );
}

async function invokeSelectedEdgeIngest(
  name: string,
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  if (name === "dados_captacoes") return invokeIngestCaptacoes(rows, onProgress);
  if (name === "positivador") return invokeIngestPositivador(rows, onProgress);
  if (name === "cetipados") return invokeIngestCetipados(rows, onProgress);
  if (name === "dados_rf_fluxo") return invokeIngestRfFluxo(rows, onProgress);
  if (name === "dados_rv_executadas") return invokeIngestRvExecutadas(rows, onProgress);
  if (name === "dados_pj_custodia") return invokeIngestPjCustodia(rows, onProgress);
  if (name === "dados_offshore_remessas") return invokeIngestOffshoreRemessas(rows, onProgress);
  if (name === "dados_offshore_operacoes") return invokeIngestOffshoreOperacoes(rows, onProgress);
  if (name === "dados_posicao_black") return invokeIngestPosicaoBlack(rows, onProgress);
  if (name === "dados_transferencias") return invokeIngestTransferencias(rows, onProgress);
  if (name === "dados_rupturas") return invokeIngestRupturas(rows, onProgress);
  if (name === "dados_fp") return invokeIngestFp(rows, onProgress);
  if (name === "dados_modelo_servir") return invokeIngestModeloServir(rows, onProgress);
  if (name === "dados_habilitacoes") return invokeIngestHabAtiv("habilitacao", rows, onProgress);
  if (name === "dados_ativacoes") return invokeIngestHabAtiv("ativacao", rows, onProgress);
  if (name === "dados_cambio") return invokeIngestCambio(rows, onProgress);
  if (name === "dados_nps") return invokeIngestNps(rows, onProgress);
  throw new Error(`Base sem ingestão direta: ${name}`);
}

async function invokeIngestNps(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  const slim = slimNpsRows(rows);
  const chunks = chunkRows(slim, 400);
  let last: Record<string, unknown> | null = null;
  let gravadas = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    const sent = Math.min((i + 1) * 400, slim.length);
    onProgress?.({
      percent: Math.round(18 + (i / Math.max(chunks.length, 1)) * 78),
      label: i === 0 ? "Limpando a tabela e gravando o primeiro lote..." : `Gravando lote ${i + 1} de ${chunks.length}...`,
      current: i * 400,
      total: slim.length,
    });
    const { data, error } = await supabase.functions.invoke("ingest-nps", {
      body: {
        chunked: true,
        rows: chunks[i],
        replace_all: i === 0,
      },
    });
    await throwIfFunctionFailed(error, data);
    gravadas += Number(data?.gravadas ?? 0);
    last = data;
    onProgress?.({
      percent: Math.round(18 + ((i + 1) / Math.max(chunks.length, 1)) * 78),
      label: i === chunks.length - 1 ? "Finalizando a carga..." : `Lote ${i + 1} de ${chunks.length} gravado`,
      current: sent,
      total: slim.length,
    });
  }

  return { ...last, gravadas, total_linhas_enviadas: gravadas };
}

async function invokeIngestCambio(
  rows: Record<string, unknown>[],
  onProgress?: (progress: UploadProgress) => void,
) {
  return invokeChunkedIngest(
    "ingest-cambio",
    slimCambioRows(rows),
    ["Data", "data"],
    onProgress,
  );
}

function startCreepingProgress(
  onProgress: ((progress: UploadProgress) => void) | undefined,
  from: number,
  to: number,
  label: string,
  total?: number,
) {
  let current = from;
  const timer = window.setInterval(() => {
    current = Math.min(to, current + Math.max(1, (to - current) * 0.08));
    onProgress?.({ percent: Math.round(current), label, total });
  }, 350);
  return () => window.clearInterval(timer);
}

function UploadProgressPanel({
  sending,
  error,
  errorMessage,
  result,
  progress,
  fileName,
  baseLabel,
  variant = "upload",
}: {
  sending: boolean;
  error: boolean;
  errorMessage: string | null;
  result: { total_linhas_enviadas: number } | null;
  progress: UploadProgress;
  fileName?: string;
  baseLabel?: string;
  variant?: "upload" | "views";
}) {
  const percent = error ? progress.percent : result ? 100 : Math.max(0, Math.min(100, progress.percent));
  const tone = error ? "text-red-400" : result ? "text-emerald-400" : "text-euro-gold";
  const bar = error
    ? "bg-red-400"
    : result
      ? "bg-emerald-400"
      : "bg-gradient-to-r from-euro-gold/70 to-euro-gold";
  const isViews = variant === "views";

  return (
    <>
      <DialogHeader>
        <div className="mb-1 flex items-center gap-3">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]", tone)}>
            {sending && <Loader2 className="h-5 w-5 animate-spin" />}
            {error && <AlertCircle className="h-5 w-5" />}
            {result && !error && <CheckCircle2 className="h-5 w-5" />}
          </div>
          <div>
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              {sending
                ? isViews ? "Atualizando o dashboard" : "Atualizando a base"
                : error
                  ? isViews ? "Falha no recálculo" : "Falha na carga"
                  : isViews ? "Dashboards atualizados" : "Carga concluída"}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {sending
                ? progress.label || (isViews ? "Recalculando as visões..." : "Processando o arquivo...")
                : error
                  ? errorMessage || (isViews
                    ? "Não foi possível atualizar as visões. Tente de novo."
                    : "Não foi possível gravar os dados. Confira o arquivo e tente de novo.")
                  : isViews
                    ? "Resumo do assessor e detalhamento de ativações foram recalculados."
                    : `${(result?.total_linhas_enviadas ?? 0).toLocaleString("pt-BR")} linhas gravadas.`}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-end justify-between text-sm">
            <span className="text-white/45">{sending ? "Andamento" : error ? "Interrompido" : "Finalizado"}</span>
            <span className={cn("font-data text-lg tabular-nums", tone)}>{percent}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500 ease-out", bar)}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {(fileName || baseLabel || progress.total) && (
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
            {baseLabel && (
              <p><span className="text-white/35">{isViews ? "Visões · " : "Base · "}</span>{baseLabel}</p>
            )}
            {fileName && (
              <p className="truncate"><span className="text-white/35">Arquivo · </span>{fileName}</p>
            )}
            {typeof progress.total === "number" && progress.total > 0 && (
              <p>
                <span className="text-white/35">{isViews ? "Etapas · " : "Linhas · "}</span>
                {(progress.current ?? (result ? progress.total : 0)).toLocaleString("pt-BR")}
                {" / "}
                {progress.total.toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        )}

        {!sending && (
          <p className="text-center text-xs text-white/35">Clique fora para fechar</p>
        )}
      </div>
    </>
  );
}

const TABLE_DISPLAY_NAMES: Record<string, string> = {
  dados_fp: "Financial Planning",
  dados_modelo_servir: "Modelo de servir",
  dados_habilitacao_ativacao: "Habilitação e ativação",
  dados_diversificador_full: "Diversificador",
  dados_nps: "NPS",
};

function prettyTableName(name: string) {
  if (TABLE_DISPLAY_NAMES[name]) return TABLE_DISPLAY_NAMES[name];
  return name.replace(/^dados_/, "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function freshnessBucket(date: string | null) {
  if (!date) return "unknown";
  const parsed = date.length === 10 ? new Date(`${date}T00:00:00`) : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  const days = (Date.now() - parsed.getTime()) / 86_400_000;
  if (days <= 2) return "ok";
  if (days <= 10) return "warn";
  return "stale";
}

function freshnessTone(date: string | null) {
  const bucket = freshnessBucket(date);
  if (bucket === "ok") return "bg-emerald-400";
  if (bucket === "warn") return "bg-euro-gold";
  if (bucket === "stale") return "bg-red-400";
  return "bg-white/30";
}

function FreshnessDot({ date }: { date: string | null }) {
  return <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", freshnessTone(date))} />;
}

function FreshnessFilterBadge({
  active,
  onClick,
  label,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-white/25 bg-white/[0.1] text-white"
          : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white",
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
      {label}
    </button>
  );
}

function StatusSortHeader({
  label,
  sortKey,
  current,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  sortKey: StatusSortKey;
  current: { key: StatusSortKey; dir: "asc" | "desc" };
  onSort: (key: StatusSortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = current.key === sortKey;
  return (
    <th className={cn("px-4 py-3.5 font-medium", align === "right" && "text-right", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-white",
          align === "right" && "ml-auto",
          active ? "text-white" : "text-white/40",
        )}
      >
        {label}
        {active
          ? current.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          : <ArrowDown className="h-3 w-3 opacity-30" />}
      </button>
    </th>
  );
}

function HubReportLink({ tableName }: { tableName: string }) {
  const href = HUB_LINKS[tableName];
  if (!href) return <span className="text-xs text-white/20">—</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-medium text-white/70 transition-colors hover:border-euro-gold/30 hover:bg-euro-gold/10 hover:text-euro-gold"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      Hub
    </a>
  );
}

function GhostButton({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-35",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
