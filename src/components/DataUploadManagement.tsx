import { useMemo, useState, useRef, useEffect, type ButtonHTMLAttributes } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Send } from "lucide-react";
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
] as const;

interface TabelaInfo {
  table_name: string;
  ultima_data_registro: string | null;
  ultima_atualizacao: string | null;
  total_registros: number;
}

export function DataUploadManagement() {
  const { user } = useAuth();

  const [selectedUploadName, setSelectedUploadName] = useState<string>("");
  const [webhookFile, setWebhookFile] = useState<File | null>(null);
  const [isWebhookSending, setIsWebhookSending] = useState(false);
  const [showN8NProgressModal, setShowN8NProgressModal] = useState(false);
  const [n8nResult, setN8nResult] = useState<{ total_linhas_enviadas: number } | null>(null);
  const [n8nError, setN8nError] = useState<boolean>(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [fileLineCount, setFileLineCount] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const webhookFileInputRef = useRef<HTMLInputElement>(null);

  const [tabelasInfo, setTabelasInfo] = useState<TabelaInfo[]>([]);
  const [isLoadingTabelas, setIsLoadingTabelas] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

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
    setShowConfirmationModal(true);
  };

  const confirmAndSendWebhook = async () => {
    setShowConfirmationModal(false);
    setIsWebhookSending(true);
    setShowN8NProgressModal(true);
    setN8nResult(null);
    setN8nError(false);

    let webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/uploads";
    if (selectedUploadName === "positivador") webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/positivador";
    else if (selectedUploadName === "dados_captacoes") webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/uploads";
    else if (selectedUploadName === "cetipados") webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/cetipados";
    else if (selectedUploadName === "dados_rv_executadas") webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/rv-executadas";
    else if (selectedUploadName === "dados_transferencias") webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/transferencias";
    else if (selectedUploadName === "dados_rf_fluxo") webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/rf-fluxo";
    else if (selectedUploadName === "dados_pj_custodia") webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/pj-custodia";
    else if (selectedUploadName === "dados_offshore_remessas") webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/offshore-remessas";
    else if (selectedUploadName === "dados_offshore_operacoes") webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/offshore-operacoes";
    else if (selectedUploadName === "dados_fundos_novo") webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/fundos";
    else if (selectedUploadName === "dados_posicao_black") webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/uploads/posicao-black";
    else if (selectedUploadName === "dados_diversificador") webhookUrl = "https://n8n-n8n.ffder9.easypanel.host/webhook/diversificador";

    try {
      if (!webhookFile || webhookFile.size === 0) {
        throw new Error("Arquivo inválido ou vazio. Por favor, selecione o arquivo novamente.");
      }

      const formData = new FormData();
      const fileExtension = webhookFile.name.split(".").pop();
      formData.append("file", webhookFile, `${selectedUploadName}.${fileExtension}`);
      formData.append("selected_name", selectedUploadName);
      formData.append("user_id", user!.id);

      const response = await fetch(webhookUrl, { method: "POST", body: formData });
      if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

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

      setN8nResult({ total_linhas_enviadas: totalLinhas ?? 0 });
      setWebhookFile(null);
      setSelectedUploadName("");
      if (webhookFileInputRef.current) webhookFileInputRef.current.value = "";
      fetchTabelasInfo();
    } catch (error) {
      console.error("Erro ao enviar webhook:", error);
      setN8nError(true);
      setN8nResult(null);
    } finally {
      setIsWebhookSending(false);
    }
  };

  const selectedLabel = UPLOAD_TYPES.find((item) => item.value === selectedUploadName)?.label || selectedUploadName;

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
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
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
            disabled={!webhookFile || !selectedUploadName || isWebhookSending}
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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {freshnessCounts.ok} em dia
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-euro-gold" />
              {freshnessCounts.warn} atenção
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {freshnessCounts.stale} atrasadas
            </span>
            <GhostButton onClick={fetchTabelasInfo} disabled={isLoadingTabelas} className="h-10">
              <RefreshCw className={cn("h-4 w-4", isLoadingTabelas && "animate-spin")} />
              Atualizar
            </GhostButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {isLoadingTabelas && tabelasInfo.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-white/40">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando bases...
            </div>
          ) : tabelasInfo.length === 0 ? (
            <p className="px-5 py-16 text-center text-white/40">Nenhuma informação de tabela encontrada.</p>
          ) : (
            <>
              <table className="hidden w-full text-left md:table">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.025] text-[11px] uppercase tracking-wide text-white/40">
                    <th className="px-5 py-3.5 font-medium">Base</th>
                    <th className="px-4 py-3.5 font-medium">Último registro</th>
                    <th className="px-4 py-3.5 font-medium">Atualização</th>
                    <th className="px-5 py-3.5 text-right font-medium">Registros</th>
                  </tr>
                </thead>
                <tbody>
                  {tabelasInfo.map((tabela) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="divide-y divide-white/[0.06] md:hidden">
                {tabelasInfo.map((tabela) => (
                  <div key={tabela.table_name} className="flex items-start gap-3 px-5 py-4">
                    <FreshnessDot date={tabela.ultima_atualizacao} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{prettyTableName(tabela.table_name)}</p>
                      <p className="mt-1 text-xs text-white/40">
                        {formatDateSafe(tabela.ultima_atualizacao)} · {tabela.total_registros.toLocaleString("pt-BR")} registros
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={showN8NProgressModal}
        onOpenChange={isWebhookSending ? undefined : (open) => {
          if (!open) {
            setShowN8NProgressModal(false);
            setN8nError(false);
            setN8nResult(null);
          }
        }}
      >
        <DialogContent className={cn(dialogClass, "sm:max-w-md")}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              {isWebhookSending ? "Enviando" : n8nError ? "Erro no processamento" : n8nResult ? "Concluído" : "Processamento"}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {isWebhookSending
                ? "Processando o arquivo automaticamente. Aguarde."
                : n8nError
                  ? "Não foi possível enviar os dados. Confira o tipo de arquivo e as colunas originais."
                  : n8nResult
                    ? `${n8nResult.total_linhas_enviadas} linhas enviadas para o banco.`
                    : "Processamento finalizado."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {isWebhookSending && <Loader2 className="h-10 w-10 animate-spin text-euro-gold" />}
            {n8nError && <AlertCircle className="h-10 w-10 text-red-400" />}
            {n8nResult && !n8nError && <CheckCircle2 className="h-10 w-10 text-emerald-400" />}
          </div>
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

function prettyTableName(name: string) {
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
