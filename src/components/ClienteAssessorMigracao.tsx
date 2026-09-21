import { useCallback, useEffect, useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ArrowRightLeft, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

const fieldClass =
  "h-11 rounded-2xl border-white/10 bg-white/[0.04] text-[#F4F1E8] placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-euro-gold/40 focus-visible:ring-offset-0";

type Regra = {
  id: string;
  cliente: string;
  assessor_destino: string;
  assessor_origem: string | null;
  desde_data: string;
  ativo: boolean;
  motivo: string | null;
  created_at: string;
};

function parseClientes(raw: string): string[] {
  const parts = raw.split(/[\s,;]+/).map((p) => p.replace(/\D/g, "")).filter(Boolean);
  return [...new Set(parts)];
}

function normalizeAssessorA(raw: string): string | null {
  const digits = raw.trim().toUpperCase().replace(/^A/, "").replace(/\D/g, "");
  return digits ? `A${digits}` : null;
}

function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
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

export function ClienteAssessorMigracao() {
  const { user, userRole } = useAuth();
  const canMigrate = userRole === "admin_master" || userRole === "admin";
  const [clientesRaw, setClientesRaw] = useState("");
  const [destino, setDestino] = useState("");
  const [origem, setOrigem] = useState("");
  const [desde, setDesde] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState("");
  const [preview, setPreview] = useState<Record<string, number> | null>(null);
  const [applyResult, setApplyResult] = useState<Record<string, number> | null>(null);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [loadingRegras, setLoadingRegras] = useState(false);
  const [busy, setBusy] = useState<"preview" | "apply" | "reapply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [regraToDeactivate, setRegraToDeactivate] = useState<Regra | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const loadRegras = useCallback(async () => {
    setLoadingRegras(true);
    const { data, error: err } = await supabase
      .from("cliente_assessor_regra" as never)
      .select("id, cliente, assessor_destino, assessor_origem, desde_data, ativo, motivo, created_at")
      .eq("ativo", true)
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setRegras((data as Regra[]) || []);
    setLoadingRegras(false);
  }, []);

  useEffect(() => {
    void loadRegras();
  }, [loadRegras]);

  const runPreview = async () => {
    setError(null);
    setInfo(null);
    setApplyResult(null);
    const clientes = parseClientes(clientesRaw);
    const dest = normalizeAssessorA(destino);
    if (clientes.length === 0) {
      setError("Informe ao menos um cliente");
      return;
    }
    if (!dest) {
      setError("Assessor destino inválido");
      return;
    }
    if (!desde) {
      setError("Informe a data desde");
      return;
    }
    setBusy("preview");
    const { data, error: err } = await supabase.rpc("preview_cliente_assessor_regra" as never, {
      p_clientes: clientes,
      p_destino: dest,
      p_desde: desde,
      p_origem: origem.trim() ? normalizeAssessorA(origem) : null,
    } as never);
    setBusy(null);
    if (err) {
      setError(err.message);
      return;
    }
    setPreview((data as Record<string, number>) || {});
  };

  const runApply = async () => {
    setError(null);
    setInfo(null);
    const clientes = parseClientes(clientesRaw);
    const dest = normalizeAssessorA(destino);
    if (clientes.length === 0 || !dest || !desde) {
      setError("Preencha clientes, destino e desde");
      return;
    }
    setBusy("apply");
    const origemNorm = origem.trim() ? normalizeAssessorA(origem) : null;

    for (const cliente of clientes) {
      await supabase
        .from("cliente_assessor_regra" as never)
        .update({ ativo: false, updated_at: new Date().toISOString() } as never)
        .eq("cliente", cliente)
        .eq("ativo", true);

      const { error: insErr } = await supabase.from("cliente_assessor_regra" as never).insert({
        cliente,
        assessor_destino: dest,
        assessor_origem: origemNorm,
        desde_data: desde,
        ativo: true,
        motivo: motivo.trim() || null,
        created_by: user?.id ?? null,
      } as never);
      if (insErr) {
        setBusy(null);
        setError(insErr.message);
        return;
      }
    }

    const { data, error: err } = await supabase.rpc("aplicar_cliente_assessor_regra" as never, {
      p_clientes: clientes,
      p_destino: dest,
      p_desde: desde,
      p_origem: origemNorm,
    } as never);
    setBusy(null);
    if (err) {
      setError(err.message);
      return;
    }
    setApplyResult((data as Record<string, number>) || {});
    setPreview(null);
    setInfo("Migração aplicada e regra salva. Volte em Cargas e rode “Atualizar dashboards” para refletir no BI.");
    setClientesRaw("");
    await loadRegras();
  };

  const confirmDeactivate = async () => {
    if (!regraToDeactivate) return;
    setDeactivating(true);
    setError(null);
    const { error: err } = await supabase
      .from("cliente_assessor_regra" as never)
      .update({ ativo: false, updated_at: new Date().toISOString() } as never)
      .eq("id", regraToDeactivate.id);
    setDeactivating(false);
    if (err) {
      setError(err.message);
      return;
    }
    setRegraToDeactivate(null);
    setInfo("Regra desativada. Os dados já migrados não são revertidos; próximas cargas do positivador deixam de forçar este destino.");
    await loadRegras();
  };

  const reaplicarTodas = async () => {
    setError(null);
    setInfo(null);
    setBusy("reapply");
    const { data, error: err } = await supabase.rpc("reaplicar_cliente_assessor_regras_ativas" as never);
    setBusy(null);
    if (err) {
      setError(err.message);
      return;
    }
    setApplyResult((data as Record<string, number>) || {});
    setInfo("Regras ativas reaplicadas. Atualize os dashboards se precisar.");
  };

  const counts = preview || applyResult;
  const totalLinhas = counts
    ? Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0)
    : 0;

  if (!canMigrate) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <div className="shrink-0 rounded-[28px] border border-white/10 bg-[#12141A] p-5 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)]">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-white">
              <ArrowRightLeft className="h-4 w-4 text-euro-gold" />
              Migração de clientes
            </p>
            <p className="mt-1 text-xs text-white/40">
              Move contas entre assessores nas bases e persiste a regra para as próximas cargas do positivador.
            </p>
          </div>
          <GhostButton onClick={() => void reaplicarTodas()} disabled={busy !== null || regras.length === 0} className="h-10 shrink-0">
            {busy === "reapply" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reaplicar ativas
          </GhostButton>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="space-y-2 lg:col-span-2">
            <Label className="text-[13px] font-medium text-white/50">Clientes (conta)</Label>
            <textarea
              value={clientesRaw}
              onChange={(e) => setClientesRaw(e.target.value)}
              placeholder={"Uma conta por linha ou separadas por vírgula\n9137491\n9946885"}
              rows={3}
              className={cn(fieldClass, "h-auto min-h-[88px] w-full resize-y px-3 py-2.5 font-data text-sm")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-white/50">Assessor destino</Label>
            <Input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="A40042"
              className={fieldClass}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-white/50">Desde</Label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={fieldClass} />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-white/50">Assessor origem (opcional)</Label>
            <Input
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              placeholder="Só altera se for este"
              className={fieldClass}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-white/50">Motivo (opcional)</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: carteira Gustavo" className={fieldClass} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <GhostButton onClick={() => void runPreview()} disabled={busy !== null}>
            {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Pré-visualizar
          </GhostButton>
          <button
            type="button"
            onClick={() => void runApply()}
            disabled={busy !== null}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-euro-gold px-5 text-sm font-semibold text-euro-navy transition-colors hover:bg-euro-gold/90 disabled:pointer-events-none disabled:opacity-35"
          >
            {busy === "apply" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            Aplicar e persistir
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        )}
        {info && (
          <p className="mt-3 rounded-2xl border border-euro-gold/30 bg-euro-gold/10 px-3 py-2 text-sm text-euro-gold">{info}</p>
        )}

        {counts && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-white/40">
              {preview ? "Prévia" : "Aplicado"} · {totalLinhas.toLocaleString("pt-BR")} linhas
            </p>
            <div className="grid max-h-40 grid-cols-2 gap-1 overflow-auto text-xs text-white/70 sm:grid-cols-3">
              {Object.entries(counts)
                .filter(([, n]) => Number(n) > 0)
                .sort((a, b) => Number(b[1]) - Number(a[1]))
                .map(([tabela, n]) => (
                  <div key={tabela} className="flex justify-between gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5">
                    <span className="truncate font-data text-white/50">{tabela.replace(/^dados_/, "")}</span>
                    <span className="tabular-nums text-euro-gold">{Number(n).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              {Object.values(counts).every((n) => Number(n) === 0) && (
                <p className="col-span-full text-white/40">Nenhuma linha a alterar com esses filtros.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-[#12141A] p-5 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-white/40">
            Regras ativas · {regras.length}
          </p>
          <button
            type="button"
            onClick={() => void loadRegras()}
            disabled={loadingRegras}
            className="text-xs text-white/40 hover:text-white"
          >
            {loadingRegras ? "..." : "Atualizar lista"}
          </button>
        </div>
        {regras.length === 0 ? (
          <p className="text-sm text-white/35">Nenhuma regra ativa.</p>
        ) : (
          <div className="max-h-[min(50vh,28rem)] space-y-1.5 overflow-auto">
            {regras.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-data text-white">
                    {r.cliente} → {r.assessor_destino}
                    <span className="text-white/40"> · desde {String(r.desde_data).slice(0, 10)}</span>
                  </p>
                  <p className="truncate text-[11px] text-white/35">
                    {r.assessor_origem ? `origem ${r.assessor_origem}` : "qualquer origem"}
                    {r.motivo ? ` · ${r.motivo}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRegraToDeactivate(r)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-red-500/15 hover:text-red-300"
                  title="Desativar regra"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!regraToDeactivate} onOpenChange={(open) => !open && !deactivating && setRegraToDeactivate(null)}>
        <AlertDialogContent className="border-white/10 bg-[#12141A] text-[#F4F1E8] sm:rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar esta regra?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              {regraToDeactivate
                ? `A regra ${regraToDeactivate.cliente} → ${regraToDeactivate.assessor_destino} deixa de valer nas próximas cargas. Não apaga o histórico nem desfaz as linhas já migradas.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deactivating}
              className="border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deactivating}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeactivate();
              }}
              className="bg-red-500/90 text-white hover:bg-red-500"
            >
              {deactivating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
