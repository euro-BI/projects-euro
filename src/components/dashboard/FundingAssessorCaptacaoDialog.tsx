import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpDown, Search, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AssessorResumo } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import { stripAssessorPrefix, withAssessorPrefix } from "@/components/dashboard/private/private-detail-utils";

type MovementRow = {
  id: string;
  data: string;
  cliente: string;
  tipo: string;
  detalhe: string;
  valor: number;
};

type SortKey = "data" | "cliente" | "tipo" | "detalhe" | "valor";

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}

async function fetchAssessorMovements(codAssessor: string, monthStart: string): Promise<MovementRow[]> {
  // selectedMonth no comercial é a data_posicao (ex.: 2026-09-11); o recorte precisa ser o mês todo.
  const start = startOfMonth(parseISO(monthStart));
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(addMonths(start, 1), "yyyy-MM-dd");
  const withA = withAssessorPrefix(codAssessor);
  const withoutA = stripAssessorPrefix(codAssessor);
  const assessorCodes = [...new Set([withA, withoutA].filter(Boolean))];

  const captacoesClient = supabase.from("dados_captacoes" as never) as unknown as {
    select: (cols: string) => any;
  };
  const transferenciasClient = supabase.from("vw_transferencias_assessor" as never) as unknown as {
    select: (cols: string) => any;
  };
  const dadosTransfClient = supabase.from("dados_transferencias" as never) as unknown as {
    select: (cols: string) => any;
  };

  const captacoesQuery = captacoesClient
    .select("id, data_captacao, cod_cliente, aux, valor_captacao, tipo_captacao")
    .in("cod_assessor", assessorCodes)
    .neq("tipo_captacao", "WEALTH")
    .neq("tipo_captacao", "TRANSF")
    .gte("data_captacao", startStr)
    .lt("data_captacao", endStr);

  const transfersQuery = transferenciasClient
    .select("cod_solicitacao, cod_cliente, data_transferencia, tipo, valor")
    .eq("cod_assessor", withA)
    .gte("data_transferencia", startStr)
    .lt("data_transferencia", endStr);

  const [{ data: captacoes, error: captacoesError }, { data: transfers, error: transfersError }] = await Promise.all([
    captacoesQuery,
    transfersQuery,
  ]);
  if (captacoesError) throw captacoesError;
  if (transfersError) throw transfersError;

  const transferRows = (transfers ?? []) as Array<Record<string, unknown>>;
  const solicitacoes = transferRows.map((row) => String(row.cod_solicitacao ?? "")).filter(Boolean);
  const transferMetaBySolicitacao = new Map<string, {
    data: string;
    origem: string;
    destino: string;
  }>();

  if (solicitacoes.length > 0) {
    const { data: rawTransfers, error: rawError } = await dadosTransfClient
      .select("cod_solicitacao, data_transferencia, cod_assessor_origem, cod_assessor_destino")
      .in("cod_solicitacao", solicitacoes);
    if (rawError) throw rawError;
    for (const row of (rawTransfers ?? []) as Array<Record<string, unknown>>) {
      const code = String(row.cod_solicitacao ?? "");
      if (!code) continue;
      transferMetaBySolicitacao.set(code, {
        data: String(row.data_transferencia ?? ""),
        origem: String(row.cod_assessor_origem ?? "-") || "-",
        destino: String(row.cod_assessor_destino ?? "-") || "-",
      });
    }
  }

  const rows: MovementRow[] = [];

  for (const row of (captacoes ?? []) as Array<Record<string, unknown>>) {
    const valor = Number(row.valor_captacao) || 0;
    rows.push({
      id: `cap-${String(row.id ?? `${row.cod_cliente}-${row.data_captacao}`)}`,
      data: String(row.data_captacao ?? ""),
      cliente: String(row.cod_cliente ?? ""),
      tipo: row.aux === "C" ? "Entrada" : "Saída",
      detalhe: String(row.tipo_captacao || "Captação"),
      valor,
    });
  }

  for (const row of transferRows) {
    const valor = Number(row.valor) || 0;
    const solicitacao = String(row.cod_solicitacao ?? "");
    const meta = transferMetaBySolicitacao.get(solicitacao);
    const tipoView = String(row.tipo ?? "").trim();
    const origem = meta?.origem || "-";
    const destino = meta?.destino || "-";
    const fluxo =
      tipoView === "Entrada" || tipoView === "Saída" || tipoView === "Interna"
        ? tipoView
        : valor >= 0
          ? "Entrada"
          : "Saída";

    rows.push({
      id: `tr-${solicitacao || `${row.cod_cliente}-${row.data_transferencia}`}`,
      data: meta?.data || String(row.data_transferencia ?? ""),
      cliente: String(row.cod_cliente ?? ""),
      tipo: valor >= 0 ? "Transf. entrada" : "Transf. saída",
      detalhe: solicitacao
        ? `${fluxo} · ${origem} → ${destino} · #${solicitacao}`
        : `${fluxo} · ${origem} → ${destino}`,
      valor,
    });
  }

  return rows.sort((a, b) => {
    const byDate = b.data.localeCompare(a.data);
    if (byDate !== 0) return byDate;
    return a.cliente.localeCompare(b.cliente, "pt-BR");
  });
}

export function FundingAssessorCaptacaoDialog({
  assessor,
  selectedMonth,
  onClose,
}: {
  assessor: AssessorResumo | null;
  selectedMonth: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "data",
    direction: "desc",
  });

  useEffect(() => {
    setSearch("");
    setSortConfig({ key: "data", direction: "desc" });
  }, [assessor?.cod_assessor]);

  const monthLabel = useMemo(() => {
    if (!selectedMonth) return "";
    try {
      return format(parseISO(selectedMonth), "MMMM yyyy", { locale: ptBR });
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth]);

  const { data, isLoading } = useQuery({
    queryKey: ["funding-assessor-captacao", assessor?.cod_assessor, selectedMonth],
    enabled: !!assessor && !!selectedMonth,
    queryFn: () => fetchAssessorMovements(assessor!.cod_assessor, selectedMonth),
  });

  const rows = data ?? [];

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? rows.filter((row) => `${row.cliente} ${row.tipo} ${row.detalhe}`.toLowerCase().includes(term))
      : rows;

    const factor = sortConfig.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const valueA = a[sortConfig.key];
      const valueB = b[sortConfig.key];
      if (typeof valueA === "number" && typeof valueB === "number") return (valueA - valueB) * factor;
      return String(valueA).localeCompare(String(valueB), "pt-BR") * factor;
    });
  }, [rows, search, sortConfig]);

  const total = visibleRows.reduce((acc, row) => acc + row.valor, 0);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  return (
    <Dialog open={!!assessor} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#0a0e14] border-white/10 text-[#E8E8E0] p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-5xl">
        <DialogHeader className="p-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-euro-gold/20 flex items-center justify-center border border-euro-gold/40 shrink-0">
              <Wallet className="w-5 h-5 text-euro-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl sm:text-2xl font-display text-euro-gold tracking-tight text-left">
                {assessor?.nome_assessor || "Assessor"}
              </DialogTitle>
              <p className="font-data text-[11px] text-white/40 mt-1 text-left uppercase tracking-widest">
                Captação e transferência por cliente • {monthLabel} • {assessor?.cod_assessor}
              </p>
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente, tipo ou detalhe..."
              className="pl-9 h-9 bg-black/30 border-white/10 text-white font-data text-xs placeholder:text-white/25"
            />
          </div>
        </DialogHeader>

        <div className="p-6 pt-4">
          <div className="bg-euro-card/40 border border-white/10 rounded-xl overflow-hidden relative min-h-[180px]">
            {isLoading && <LoadingOverlay isLoading={true} />}
            <div className="max-h-[52vh] overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest">
                    {([
                      ["data", "Data", "left"],
                      ["cliente", "Cliente", "left"],
                      ["tipo", "Tipo", "left"],
                      ["detalhe", "Detalhe", "left"],
                      ["valor", "Valor", "right"],
                    ] as const).map(([key, label, align], index, list) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className={cn(
                          "py-3 px-4 font-bold bg-euro-gold cursor-pointer hover:bg-euro-navy/5 transition-colors",
                          index < list.length - 1 && "border-r border-euro-navy/10",
                          align === "right" && "text-right",
                        )}
                      >
                        <div className={cn("flex items-center gap-1", align === "right" && "justify-end")}>
                          {label}
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {visibleRows.length > 0 ? visibleRows.map((row) => (
                    <tr key={row.id} className="even:bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-[12.5px] font-data">
                      <td className="py-2.5 px-4 text-white/85 border-r border-white/5">
                        {row.data ? format(parseISO(row.data), "dd/MM/yyyy") : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-white border-r border-white/5 font-mono">{row.cliente || "—"}</td>
                      <td className="py-2.5 px-4 text-white/70 border-r border-white/5">{row.tipo}</td>
                      <td className="py-2.5 px-4 text-white/70 border-r border-white/5">{row.detalhe}</td>
                      <td className={cn("py-2.5 px-4 text-right font-mono", row.valor >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {formatMoney(row.valor)}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="py-16 text-center opacity-20">
                        <div className="flex flex-col items-center gap-3">
                          <Search className="w-9 h-9" />
                          <p className="text-sm font-data uppercase tracking-widest">
                            {isLoading ? "Carregando" : "Nenhuma movimentação no período"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 font-data text-xs">
            <span className="text-white/40">
              {visibleRows.length.toLocaleString("pt-BR")}{" "}
              {visibleRows.length === 1 ? "registro" : "registros"}
            </span>
            <span className="text-white/60">
              Líquida total:{" "}
              <span className={cn("font-display text-sm ml-1", total >= 0 ? "text-euro-gold" : "text-rose-400")}>
                {formatMoney(total)}
              </span>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
