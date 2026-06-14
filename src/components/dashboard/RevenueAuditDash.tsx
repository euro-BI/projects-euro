import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { parseISO } from "date-fns";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { AssessorResumo } from "@/types/dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RevenueAuditDashProps = {
  selectedMonth: string;
  assessors: AssessorResumo[];
};

type RevenueField =
  | "receita_b3"
  | "receitas_estruturadas"
  | "receitas_ofertas_fundos"
  | "receitas_ofertas_rf"
  | "receita_renda_fixa"
  | "receita_previdencia"
  | "receita_consorcios"
  | "receita_cambio"
  | "receita_compromissadas"
  | "receitas_offshore"
  | "receita_seguros";

type DRARevenueRow = {
  cod_interno: string | null;
  assessor: string | null;
  receita: string | null;
  competencia: string | null;
  valor_comissao: number | string | null;
};

type AuditRow = {
  assessorCodigo: string;
  assessorNome: string;
  receitaNome: string;
  competencia: string;
  valorXp: number;
  valorDra: number;
  diferenca: number;
  percentualDiferenca: number | null;
};

type SelectedAuditRow = {
  assessorCodigo: string;
  assessorNome: string;
  receitaNome: string;
  competencia: string;
};

type DRAMapRow = {
  familia_categoria: string | null;
  receita: string | null;
};

type DRAAnaliticoRawRow = {
  competencia?: string | null;
  cod_interno?: string | null;
  nome_agente?: string | null;
  familia_categoria?: string | null;
  escr_vl_comis?: string | number | null;
  [key: string]: unknown;
};

type DRAAnaliticoDetailRow = {
  competencia: string;
  assessorCodigo: string;
  assessorNome: string;
  familiaCategoria: string;
  receitaMapeada: string;
  valorComissao: number;
};

type SortKey =
  | "assessorCodigo"
  | "assessorNome"
  | "receitaNome"
  | "valorXp"
  | "valorDra"
  | "diferenca"
  | "percentualDiferenca";

type SortConfig = {
  key: SortKey;
  direction: "asc" | "desc";
};

const REVENUE_CONFIG: Array<{ label: string; field: RevenueField }> = [
  { label: "Receita B3", field: "receita_b3" },
  { label: "Receitas Estruturadas", field: "receitas_estruturadas" },
  { label: "Receitas Ofertas Fundos", field: "receitas_ofertas_fundos" },
  { label: "Receitas Ofertas RF", field: "receitas_ofertas_rf" },
  { label: "Receita Renda Fixa", field: "receita_renda_fixa" },
  { label: "Receita Previdência", field: "receita_previdencia" },
  { label: "Receita Consórcios", field: "receita_consorcios" },
  { label: "Receita Câmbio", field: "receita_cambio" },
  { label: "Receita Compromissadas", field: "receita_compromissadas" },
  { label: "Receitas Offshore", field: "receitas_offshore" },
  { label: "Receita Seguros", field: "receita_seguros" },
];

const BLOCKED_TEAMS = new Set(["OPERACIONAIS", "ADVISORS"]);

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const cleaned = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function formatCompetencia(value: string) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(parseISO(value));
  } catch {
    return value;
  }
}

export default function RevenueAuditDash({
  selectedMonth,
  assessors,
}: RevenueAuditDashProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "diferenca",
    direction: "desc",
  });
  const [selectedAuditRow, setSelectedAuditRow] = useState<SelectedAuditRow | null>(null);

  const assessorCodes = useMemo(
    () =>
      Array.from(
        new Set(
          (assessors || [])
            .filter((row) => !BLOCKED_TEAMS.has(String(row.time ?? "").trim().toUpperCase()))
            .map((row) => String(row.cod_assessor ?? "").trim())
            .filter(Boolean),
        ),
      ),
    [assessors],
  );

  const filteredAssessors = useMemo(
    () => (assessors || []).filter((row) => !BLOCKED_TEAMS.has(String(row.time ?? "").trim().toUpperCase())),
    [assessors],
  );

  const { data: draRows, isLoading, error } = useQuery({
    queryKey: ["revenue-audit-dra", selectedMonth, assessorCodes.join("|")],
    enabled: !!selectedMonth && assessorCodes.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_dra_receita_resumida" as any)
        .select("cod_interno, assessor, receita, competencia, valor_comissao")
        .eq("competencia", selectedMonth)
        .neq("receita", "N/A")
        .in("cod_interno", assessorCodes);

      if (error) throw error;
      return (data || []) as DRARevenueRow[];
    },
  });

  const {
    data: detailRows,
    isLoading: isDetailLoading,
    error: detailError,
  } = useQuery({
    queryKey: [
      "revenue-audit-dra-detail",
      selectedAuditRow?.competencia,
      selectedAuditRow?.assessorCodigo,
      selectedAuditRow?.receitaNome,
    ],
    enabled: !!selectedAuditRow,
    queryFn: async () => {
      if (!selectedAuditRow) return [] as DRAAnaliticoDetailRow[];

      const [{ data: rawRows, error: rawError }, { data: mapRows, error: mapError }] = await Promise.all([
        supabase
          .from("dados_dra_analitico" as any)
          .select("*")
          .eq("competencia", selectedAuditRow.competencia)
          .eq("cod_interno", selectedAuditRow.assessorCodigo),
        supabase
          .from("dados_map_dra_receita" as any)
          .select("familia_categoria, receita"),
      ]);

      if (rawError) throw rawError;
      if (mapError) throw mapError;

      const mapping = new Map<string, string>();
      (mapRows as DRAMapRow[] | null | undefined)?.forEach((row) => {
        const key = String(row.familia_categoria ?? "").trim().toUpperCase();
        const receita = String(row.receita ?? "").trim() || "N/A";
        if (key) mapping.set(key, receita);
      });

      return ((rawRows as DRAAnaliticoRawRow[] | null | undefined) || [])
        .map((row) => {
          const familiaCategoria = String(row.familia_categoria ?? "").trim();
          const receitaMapeada = mapping.get(familiaCategoria.toUpperCase()) || "N/A";

          return {
            competencia: String(row.competencia ?? selectedAuditRow.competencia),
            assessorCodigo: String(row.cod_interno ?? selectedAuditRow.assessorCodigo),
            assessorNome: String(row.nome_agente ?? selectedAuditRow.assessorNome),
            familiaCategoria,
            receitaMapeada,
            valorComissao: parseNumber(row.escr_vl_comis),
          } satisfies DRAAnaliticoDetailRow;
        })
        .filter((row) => row.receitaMapeada === selectedAuditRow.receitaNome)
        .sort((a, b) => b.valorComissao - a.valorComissao);
    },
  });

  const rows = useMemo(() => {
    const draMap = new Map<string, number>();

    (draRows || []).forEach((row) => {
      const code = String(row.cod_interno ?? "").trim();
      const receita = String(row.receita ?? "").trim();
      if (!code || !receita) return;
      const key = `${code}::${receita}`;
      draMap.set(key, (draMap.get(key) || 0) + parseNumber(row.valor_comissao));
    });

    return filteredAssessors.flatMap((assessor) => {
      const code = String(assessor.cod_assessor ?? "").trim();
      const nome = String(assessor.nome_assessor ?? "").trim();

      return REVENUE_CONFIG.map((config) => {
        const valorXp = Number(assessor[config.field] || 0);
        const valorDra = draMap.get(`${code}::${config.label}`) || 0;
        const diferenca = valorXp - valorDra;
        const percentualDiferenca =
          valorDra !== 0 ? (diferenca / valorDra) * 100 : valorXp === 0 ? 0 : null;

        return {
          assessorCodigo: code,
          assessorNome: nome,
          receitaNome: config.label,
          competencia: selectedMonth,
          valorXp,
          valorDra,
          diferenca,
          percentualDiferenca,
        } satisfies AuditRow;
      });
    });
  }, [filteredAssessors, draRows, selectedMonth]);

  const sortedRows = useMemo(() => {
    const next = [...rows];
    next.sort((a, b) => {
      const { key, direction } = sortConfig;
      let result = 0;

      if (
        key === "valorXp" ||
        key === "valorDra" ||
        key === "diferenca"
      ) {
        result = a[key] - b[key];
      } else if (key === "percentualDiferenca") {
        result = (a.percentualDiferenca ?? Number.NEGATIVE_INFINITY) - (b.percentualDiferenca ?? Number.NEGATIVE_INFINITY);
      } else {
        result = String(a[key]).localeCompare(String(b[key]), "pt-BR", { sensitivity: "base" });
      }

      return direction === "asc" ? result : -result;
    });
    return next;
  }, [rows, sortConfig]);

  const summary = useMemo(() => {
    const totalXp = rows.reduce((acc, row) => acc + row.valorXp, 0);
    const totalDra = rows.reduce((acc, row) => acc + row.valorDra, 0);
    const totalDiff = rows.reduce((acc, row) => acc + row.diferenca, 0);
    const pct = totalDra !== 0 ? (totalDiff / totalDra) * 100 : totalXp === 0 ? 0 : null;

    return {
      totalXp,
      totalDra,
      totalDiff,
      pct,
      rowCount: rows.length,
    };
  }, [rows]);

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: key === "assessorCodigo" || key === "assessorNome" || key === "receitaNome" ? "asc" : "desc",
      };
    });
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="h-3.5 w-3.5 text-white/35" />;
    if (sortConfig.direction === "asc") return <ArrowUp className="h-3.5 w-3.5 text-euro-gold" />;
    return <ArrowDown className="h-3.5 w-3.5 text-euro-gold" />;
  };

  const downloadAuditXlsx = () => {
    const exportRows = sortedRows.map((row) => ({
      "Cod. Assessor": row.assessorCodigo,
      Assessor: row.assessorNome,
      Receita: row.receitaNome,
      Competencia: formatCompetencia(row.competencia),
      XP: row.valorXp,
      DRA: row.valorDra,
      Diferenca: row.diferenca,
      "% Diferenca": row.percentualDiferenca,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows.length ? exportRows : [{}]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Auditoria");
    XLSX.writeFile(workbook, `auditoria_receita_${selectedMonth || "periodo"}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1">
          <h2 className="text-white font-display text-xl tracking-wide">
            Auditoria da Receita
          </h2>
          <p className="text-white/50 font-data text-[11px] uppercase tracking-widest">
            Comparativo entre XP e DRA analítico por assessor e receita
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] font-data uppercase tracking-widest">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/75">
            XP: {formatCurrency(summary.totalXp)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/75">
            DRA: {formatCurrency(summary.totalDra)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/75">
            Dif.: {formatCurrency(summary.totalDiff)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/75">
            % Dif.: {formatPercent(summary.pct)}
          </span>
        </div>
      </div>

      {isLoading && (
        <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-8 text-center">
          <div className="text-white/60 font-data text-sm">
            Carregando auditoria da receita...
          </div>
        </Card>
      )}

      {!isLoading && error && (
        <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-8 text-center">
          <div className="text-white/60 font-data text-sm">
            Não foi possível carregar a auditoria da receita.
          </div>
        </Card>
      )}

      {!isLoading && !error && sortedRows.length === 0 && (
        <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-8 text-center">
          <div className="text-white/60 font-data text-sm">
            Nenhum dado encontrado para os filtros atuais.
          </div>
        </Card>
      )}

      {!isLoading && !error && sortedRows.length > 0 && (
        <Card className="bg-[#0F1218]/70 backdrop-blur-xl border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">
                {summary.rowCount} linhas comparadas
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadAuditXlsx}
                className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300"
              >
                <Download className="h-4 w-4 mr-2" />
                XLSX
              </Button>
            </div>
            <div className="text-white/35 font-data text-[10px] uppercase tracking-widest">
              Clique no cabeçalho para ordenar
            </div>
          </div>

          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                  <th className="py-0 px-0 font-medium">
                    <button type="button" onClick={() => handleSort("assessorCodigo")} className="w-full px-4 py-3 flex items-center gap-2 hover:text-white transition-colors">
                      <span>Cód.</span>
                      {renderSortIcon("assessorCodigo")}
                    </button>
                  </th>
                  <th className="py-0 px-0 font-medium">
                    <button type="button" onClick={() => handleSort("assessorNome")} className="w-full px-4 py-3 flex items-center gap-2 hover:text-white transition-colors">
                      <span>Assessor</span>
                      {renderSortIcon("assessorNome")}
                    </button>
                  </th>
                  <th className="py-0 px-0 font-medium">
                    <button type="button" onClick={() => handleSort("receitaNome")} className="w-full px-4 py-3 flex items-center gap-2 hover:text-white transition-colors">
                      <span>Receita</span>
                      {renderSortIcon("receitaNome")}
                    </button>
                  </th>
                  <th className="py-0 px-0 font-medium text-right">
                    <button type="button" onClick={() => handleSort("valorXp")} className="w-full px-4 py-3 flex items-center justify-end gap-2 hover:text-white transition-colors">
                      <span>XP</span>
                      {renderSortIcon("valorXp")}
                    </button>
                  </th>
                  <th className="py-0 px-0 font-medium text-right">
                    <button type="button" onClick={() => handleSort("valorDra")} className="w-full px-4 py-3 flex items-center justify-end gap-2 hover:text-white transition-colors">
                      <span>DRA</span>
                      {renderSortIcon("valorDra")}
                    </button>
                  </th>
                  <th className="py-0 px-0 font-medium text-right">
                    <button type="button" onClick={() => handleSort("diferenca")} className="w-full px-4 py-3 flex items-center justify-end gap-2 hover:text-white transition-colors">
                      <span>Diferença</span>
                      {renderSortIcon("diferenca")}
                    </button>
                  </th>
                  <th className="py-0 px-0 font-medium text-right">
                    <button type="button" onClick={() => handleSort("percentualDiferenca")} className="w-full px-4 py-3 flex items-center justify-end gap-2 hover:text-white transition-colors">
                      <span>% Dif.</span>
                      {renderSortIcon("percentualDiferenca")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {sortedRows.map((row) => (
                  <tr
                    key={`${row.assessorCodigo}-${row.receitaNome}`}
                    className="text-sm cursor-pointer hover:bg-white/[0.04] transition-colors"
                    onClick={() =>
                      setSelectedAuditRow({
                        assessorCodigo: row.assessorCodigo,
                        assessorNome: row.assessorNome,
                        receitaNome: row.receitaNome,
                        competencia: row.competencia,
                      })
                    }
                  >
                    <td className="py-3 px-4 text-white/65 font-data text-xs">{row.assessorCodigo}</td>
                    <td className="py-3 px-4 text-white/85 font-data text-xs">{row.assessorNome || "—"}</td>
                    <td className="py-3 px-4 text-white/80 font-data text-xs">{row.receitaNome}</td>
                    <td className="py-3 px-4 text-right text-white/80 font-data text-xs">{formatCurrency(row.valorXp)}</td>
                    <td className="py-3 px-4 text-right text-white/80 font-data text-xs">{formatCurrency(row.valorDra)}</td>
                    <td
                      className={`py-3 px-4 text-right font-data text-xs ${
                        row.diferenca > 0 ? "text-green-400" : row.diferenca < 0 ? "text-red-400" : "text-white/80"
                      }`}
                    >
                      {formatCurrency(row.diferenca)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-data text-xs ${
                        row.percentualDiferenca === null
                          ? "text-white/45"
                          : row.percentualDiferenca > 0
                            ? "text-green-400"
                            : row.percentualDiferenca < 0
                              ? "text-red-400"
                              : "text-white/80"
                      }`}
                    >
                      {formatPercent(row.percentualDiferenca)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!selectedAuditRow} onOpenChange={(open) => (!open ? setSelectedAuditRow(null) : null)}>
        <DialogContent className="bg-[#0A0A0B] border-white/10 text-white sm:max-w-[980px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white font-display text-lg tracking-wide">
              {selectedAuditRow
                ? `${selectedAuditRow.assessorNome} • ${selectedAuditRow.receitaNome}`
                : "Detalhamento DRA"}
            </DialogTitle>
          </DialogHeader>

          {selectedAuditRow && (
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-data uppercase tracking-widest">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/75">
                Assessor: {selectedAuditRow.assessorCodigo}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/75">
                Competência: {formatCompetencia(selectedAuditRow.competencia)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/75">
                Receita: {selectedAuditRow.receitaNome}
              </span>
            </div>
          )}

          {isDetailLoading && (
            <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-8 text-center">
              <div className="text-white/60 font-data text-sm">
                Carregando detalhamento do DRA...
              </div>
            </Card>
          )}

          {!isDetailLoading && detailError && (
            <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-8 text-center">
              <div className="text-white/60 font-data text-sm">
                Não foi possível carregar o detalhamento do DRA.
              </div>
            </Card>
          )}

          {!isDetailLoading && !detailError && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-data uppercase tracking-widest">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/75">
                  Registros: {detailRows?.length || 0}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/75">
                  Total DRA: {formatCurrency((detailRows || []).reduce((acc, row) => acc + row.valorComissao, 0))}
                </span>
              </div>

              <div className="rounded-xl border border-white/10 overflow-hidden">
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                      <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                        <th className="py-3 px-4 font-medium">Competência</th>
                        <th className="py-3 px-4 font-medium">Cód.</th>
                        <th className="py-3 px-4 font-medium">Assessor</th>
                        <th className="py-3 px-4 font-medium">Família Categoria</th>
                        <th className="py-3 px-4 font-medium">Receita Mapeada</th>
                        <th className="py-3 px-4 font-medium text-right">Valor Comissão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {(detailRows || []).map((row, index) => (
                        <tr key={`${row.assessorCodigo}-${row.familiaCategoria}-${index}`} className="text-sm">
                          <td className="py-3 px-4 text-white/70 font-data text-xs">{row.competencia || "—"}</td>
                          <td className="py-3 px-4 text-white/65 font-data text-xs">{row.assessorCodigo || "—"}</td>
                          <td className="py-3 px-4 text-white/85 font-data text-xs">{row.assessorNome || "—"}</td>
                          <td className="py-3 px-4 text-white/80 font-data text-xs">{row.familiaCategoria || "—"}</td>
                          <td className="py-3 px-4 text-white/70 font-data text-xs">{row.receitaMapeada || "—"}</td>
                          <td className="py-3 px-4 text-right text-white/85 font-data text-xs">
                            {formatCurrency(row.valorComissao)}
                          </td>
                        </tr>
                      ))}
                      {(detailRows || []).length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                            Nenhum lançamento encontrado no DRA para esta receita.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
