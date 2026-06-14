import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, parseISO } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { AssessorResumo } from "@/types/dashboard";

type CarteiraDistributionDashProps = {
  selectedMonth: string;
  assessors: AssessorResumo[];
};

type DistribuicaoRow = {
  assessor: string | null;
  cliente: string | null;
  produto: string | null;
  subproduto: string | null;
  fator_risco: string | null;
  ativo: string | null;
  net: number | string | null;
  data_posicao: string | null;
  distribuicao_carteira: string | null;
};

type SortKey =
  | "assessor"
  | "cliente"
  | "produto"
  | "subproduto"
  | "fator_risco"
  | "ativo"
  | "net";

type SortConfig = {
  key: SortKey;
  direction: "asc" | "desc";
};

const CARD_ORDER = [
  "Debêntures",
  "CDB",
  "CRI CRA",
  "LCA LCI",
  "Título Público Selic",
  "Tesouro Direto",
  "Fundo RF",
  "Fundo Multimercado",
  "Fundo Ações",
  "Fundo Exclusivo",
  "Carteira Adm",
  "Previdência",
  "Renda Variável",
  "FII",
  "COE Estruturadas",
  "Conta Corrente",
  "Offshore",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted}%`;
}

function normalizeAssessorCode(value: string) {
  const raw = value.trim().toUpperCase();
  if (!raw) return "";
  if (raw.startsWith("A")) return raw;
  if (/^\d+$/.test(raw)) return `A${raw}`;
  return raw;
}

function parseNet(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export default function CarteiraDistributionDash({
  selectedMonth,
  assessors,
}: CarteiraDistributionDashProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "net",
    direction: "desc",
  });

  const selectedMonthKey = useMemo(() => {
    if (!selectedMonth) return "";
    return selectedMonth.slice(0, 7);
  }, [selectedMonth]);

  const selectedMonthEnd = useMemo(() => {
    if (!selectedMonthKey) return "";
    return format(endOfMonth(parseISO(`${selectedMonthKey}-01`)), "yyyy-MM-dd");
  }, [selectedMonthKey]);

  const assessorFilter = useMemo(() => {
    const codeSet = new Set<string>();
    const nameSet = new Set<string>();

    (assessors || []).forEach((assessor) => {
      const code = normalizeAssessorCode(String(assessor.cod_assessor ?? ""));
      const name = String(assessor.nome_assessor ?? "").trim().toUpperCase();

      if (code) codeSet.add(code);
      if (name) nameSet.add(name);
    });

    return {
      codeSet,
      nameSet,
      cacheKey: Array.from(codeSet).sort().join("|"),
    };
  }, [assessors]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["gerencial-distribuicao-carteira", selectedMonthEnd, assessorFilter.cacheKey],
    enabled: !!selectedMonthEnd,
    queryFn: async () => {
      if (!selectedMonthEnd || assessorFilter.codeSet.size === 0) {
        return { latestDate: null as string | null, rows: [] as DistribuicaoRow[] };
      }

      const { data: latestDateRows, error: latestDateError } = await supabase
        .from("vw_diversificador_full" as any)
        .select("data_posicao")
        .lte("data_posicao", selectedMonthEnd)
        .order("data_posicao", { ascending: false })
        .limit(1);

      if (latestDateError) throw latestDateError;

      const latestDate = latestDateRows?.[0]?.data_posicao ?? null;
      if (!latestDate) {
        return { latestDate: null as string | null, rows: [] as DistribuicaoRow[] };
      }

      const { data: viewRows, error: viewError } = await supabase
        .from("vw_diversificador_full" as any)
        .select("assessor, cliente, produto, subproduto, fator_risco, ativo, net, data_posicao, distribuicao_carteira")
        .eq("data_posicao", latestDate)
        .range(0, 50000);

      if (viewError) throw viewError;

      const filteredRows = (viewRows || []).filter((row: any) => {
        const rawAssessor = String(row?.assessor ?? "").trim();
        if (!rawAssessor) return false;

        const normalizedCode = normalizeAssessorCode(rawAssessor);
        const normalizedName = rawAssessor.toUpperCase();

        return (
          assessorFilter.codeSet.has(normalizedCode) ||
          assessorFilter.nameSet.has(normalizedName)
        );
      }) as DistribuicaoRow[];

      return { latestDate, rows: filteredRows };
    },
  });

  const summary = useMemo(() => {
    const totals = new Map<string, number>();
    const rowsByCategory = new Map<string, DistribuicaoRow[]>();

    (data?.rows || []).forEach((row) => {
      const category = String(row.distribuicao_carteira ?? "").trim() || "Não Classificado";
      const net = parseNet(row.net);
      totals.set(category, (totals.get(category) || 0) + net);
      if (!rowsByCategory.has(category)) rowsByCategory.set(category, []);
      rowsByCategory.get(category)!.push(row);
    });

    const grandTotal = Array.from(totals.values()).reduce((acc, value) => acc + value, 0);
    const extraCategories = Array.from(totals.keys())
      .filter((category) => !CARD_ORDER.includes(category))
      .sort((a, b) => a.localeCompare(b));

    const orderedCategories = [...CARD_ORDER, ...extraCategories];
    const cards = orderedCategories.map((category) => {
      const value = totals.get(category) || 0;
      const percentage = grandTotal > 0 ? (value / grandTotal) * 100 : 0;
      const rows = (rowsByCategory.get(category) || []).slice().sort((a, b) => parseNet(b.net) - parseNet(a.net));
      return { category, value, percentage, rows };
    });

    return {
      grandTotal,
      cards,
      rowsByCategory,
      latestDate: data?.latestDate ?? null,
      hasRows: (data?.rows || []).length > 0,
    };
  }, [data]);

  const titleMonth = useMemo(() => {
    if (!selectedMonthKey) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(parseISO(`${selectedMonthKey}-01`));
  }, [selectedMonthKey]);

  const selectedCategoryRows = useMemo(() => {
    if (!selectedCategory) return [];
    return summary.cards.find((card) => card.category === selectedCategory)?.rows || [];
  }, [selectedCategory, summary.cards]);

  const sortedCategoryRows = useMemo(() => {
    const rows = [...selectedCategoryRows];
    rows.sort((a, b) => {
      if (sortConfig.key === "net") {
        const result = parseNet(a.net) - parseNet(b.net);
        return sortConfig.direction === "asc" ? result : -result;
      }

      const aValue = String(a[sortConfig.key] ?? "").trim();
      const bValue = String(b[sortConfig.key] ?? "").trim();
      const result = aValue.localeCompare(bValue, "pt-BR", { sensitivity: "base" });
      return sortConfig.direction === "asc" ? result : -result;
    });
    return rows;
  }, [selectedCategoryRows, sortConfig]);

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
        direction: key === "net" ? "desc" : "asc",
      };
    });
  };

  const downloadXlsx = () => {
    const exportRows = sortedCategoryRows.map((row) => ({
      Assessor: row.assessor || "",
      Cliente: row.cliente || "",
      Produto: row.produto || "",
      Subproduto: row.subproduto || "",
      "Fator Risco": row.fator_risco || "",
      Ativo: row.ativo || "",
      Net: parseNet(row.net),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows.length ? exportRows : [{}]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detalhamento");

    const sanitizedCategory = String(selectedCategory || "distribuicao")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();

    XLSX.writeFile(
      workbook,
      `distribuicao_carteira_${sanitizedCategory || "detalhamento"}_${selectedMonthKey || "periodo"}.xlsx`,
    );
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="h-3.5 w-3.5 text-white/35" />;
    if (sortConfig.direction === "asc") return <ArrowUp className="h-3.5 w-3.5 text-euro-gold" />;
    return <ArrowDown className="h-3.5 w-3.5 text-euro-gold" />;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1">
          <h2 className="text-white font-display text-xl tracking-wide">
            Distribuição de Carteira
          </h2>
          <p className="text-white/50 font-data text-[11px] uppercase tracking-widest">
            Soma do net por distribuição • {titleMonth || "Período não selecionado"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] font-data uppercase tracking-widest">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/75">
            Total: {formatCurrency(summary.grandTotal)}
          </span>
          {summary.latestDate && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/55">
              Snapshot: {new Intl.DateTimeFormat("pt-BR").format(parseISO(summary.latestDate))}
            </span>
          )}
        </div>
      </div>

      {isLoading && (
        <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-8 text-center">
          <div className="text-white/60 font-data text-sm">
            Carregando distribuição da carteira...
          </div>
        </Card>
      )}

      {!isLoading && error && (
        <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-8 text-center">
          <div className="text-white/60 font-data text-sm">
            Não foi possível carregar a distribuição da carteira.
          </div>
        </Card>
      )}

      {!isLoading && !error && !summary.hasRows && (
        <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-8 text-center">
          <div className="text-white/60 font-data text-sm">
            Nenhum dado encontrado para os filtros atuais.
          </div>
        </Card>
      )}

      {!isLoading && !error && summary.hasRows && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {summary.cards.map((card) => (
            <button
              key={card.category}
              type="button"
              onClick={() => setSelectedCategory(card.category)}
              className="text-left"
            >
              <Card className="bg-[#0F1218]/70 backdrop-blur-xl border-white/10 p-3 sm:p-4 min-h-[118px] flex flex-col justify-between transition-colors hover:bg-[#141924]/80">
                <div className="text-white/65 font-data text-[10px] sm:text-[11px] uppercase tracking-widest leading-snug">
                  {card.category}
                </div>

                <div className="space-y-2">
                  <div className="text-white font-display text-lg sm:text-xl leading-none">
                    {formatCurrency(card.value)}
                  </div>

                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-euro-gold/50 to-euro-gold transition-all"
                        style={{ width: `${Math.max(0, Math.min(card.percentage, 100))}%` }}
                      />
                    </div>
                    <div className="text-white/45 font-data text-[10px] uppercase tracking-widest">
                      {formatPercent(card.percentage)} do total
                    </div>
                  </div>
                </div>

              </Card>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selectedCategory} onOpenChange={(open) => (!open ? setSelectedCategory(null) : null)}>
        <DialogContent className="bg-[#0A0A0B] border-white/10 text-white sm:max-w-[1180px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white font-display text-lg tracking-wide">
              {selectedCategory ? `${selectedCategory} • Detalhamento` : "Detalhamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-data uppercase tracking-widest">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/75">
              Registros: {sortedCategoryRows.length}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/75">
              Total: {formatCurrency(sortedCategoryRows.reduce((acc, row) => acc + parseNet(row.net), 0))}
            </span>
          </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadXlsx}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300"
            >
              <Download className="h-4 w-4 mr-2" />
              XLSX
            </Button>
          </div>

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                  <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                    <th className="py-0 px-0 font-medium">
                      <button type="button" onClick={() => handleSort("assessor")} className="w-full px-4 py-3 flex items-center gap-2 hover:text-white transition-colors">
                        <span>Assessor</span>
                        {renderSortIcon("assessor")}
                      </button>
                    </th>
                    <th className="py-0 px-0 font-medium">
                      <button type="button" onClick={() => handleSort("cliente")} className="w-full px-4 py-3 flex items-center gap-2 hover:text-white transition-colors">
                        <span>Cliente</span>
                        {renderSortIcon("cliente")}
                      </button>
                    </th>
                    <th className="py-0 px-0 font-medium">
                      <button type="button" onClick={() => handleSort("produto")} className="w-full px-4 py-3 flex items-center gap-2 hover:text-white transition-colors">
                        <span>Produto</span>
                        {renderSortIcon("produto")}
                      </button>
                    </th>
                    <th className="py-0 px-0 font-medium">
                      <button type="button" onClick={() => handleSort("subproduto")} className="w-full px-4 py-3 flex items-center gap-2 hover:text-white transition-colors">
                        <span>Subproduto</span>
                        {renderSortIcon("subproduto")}
                      </button>
                    </th>
                    <th className="py-0 px-0 font-medium">
                      <button type="button" onClick={() => handleSort("fator_risco")} className="w-full px-4 py-3 flex items-center gap-2 hover:text-white transition-colors">
                        <span>Fator Risco</span>
                        {renderSortIcon("fator_risco")}
                      </button>
                    </th>
                    <th className="py-0 px-0 font-medium">
                      <button type="button" onClick={() => handleSort("ativo")} className="w-full px-4 py-3 flex items-center gap-2 hover:text-white transition-colors">
                        <span>Ativo</span>
                        {renderSortIcon("ativo")}
                      </button>
                    </th>
                    <th className="py-0 px-0 font-medium text-right">
                      <button type="button" onClick={() => handleSort("net")} className="w-full px-4 py-3 flex items-center justify-end gap-2 hover:text-white transition-colors">
                        <span>Net</span>
                        {renderSortIcon("net")}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {sortedCategoryRows.map((row, index) => (
                    <tr
                      key={`${row.assessor}-${row.cliente}-${row.ativo}-${index}`}
                      className="text-sm"
                    >
                      <td className="py-3 px-4 text-white/85 font-data text-xs">{row.assessor || "—"}</td>
                      <td className="py-3 px-4 text-white/80 font-data text-xs">{row.cliente || "—"}</td>
                      <td className="py-3 px-4 text-white/80 font-data text-xs">{row.produto || "—"}</td>
                      <td className="py-3 px-4 text-white/70 font-data text-xs">{row.subproduto || "—"}</td>
                      <td className="py-3 px-4 text-white/70 font-data text-xs">{row.fator_risco || "—"}</td>
                      <td className="py-3 px-4 text-white/70 font-data text-xs">{row.ativo || "—"}</td>
                      <td className="py-3 px-4 text-right text-white/85 font-data text-xs">
                        {formatCurrency(parseNet(row.net))}
                      </td>
                    </tr>
                  ))}
                  {sortedCategoryRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 px-4 text-center text-white/45 font-data text-sm">
                        Nenhum registro encontrado para esta distribuição.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
