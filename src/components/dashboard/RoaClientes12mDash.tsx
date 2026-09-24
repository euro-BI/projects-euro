import React, { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Info, Percent, Search, TrendingDown } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { supabase } from "@/integrations/supabase/client";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type RoaRow = {
  cod_cliente: string | null;
  nome_cliente: string | null;
  assessor: string | null;
  nome_assessor: string | null;
  janela_inicio: string | null;
  janela_fim: string | null;
  meses_com_receita: number | null;
  meses_com_base: number | null;
  receita_invest_12m: number | string | null;
  receita_liquida_12m: number | string | null;
  base_media_12m: number | string | null;
  net_atual: number | string | null;
  roa_invest_12m: number | string | null;
  roa_invest_pct: number | string | null;
  historico_receita: Record<string, number | string> | null;
  historico_net: Record<string, number | string> | null;
};

type RoaFilterMode = "abaixo" | "acima" | "todos";

type SortKey =
  | "cliente"
  | "assessor"
  | "receita"
  | "base"
  | "net"
  | "roa"
  | "meses_receita"
  | "meses_base";

type SortConfig = {
  key: SortKey;
  direction: "asc" | "desc";
};

interface RoaClientes12mDashProps {
  selectedAssessorId?: string[];
  selectedTeam?: string[];
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyCompact(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `${formatCurrency(value / 1_000_000).replace("R$", "R$")} mi`.replace(/\s+/g, " ");
  }
  if (Math.abs(value) >= 1_000) {
    return `${formatCurrency(value / 1_000).replace("R$", "R$")} mil`.replace(/\s+/g, " ");
  }
  return formatCurrency(value);
}

function formatPercent(value: number, digits = 2) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}%`;
}

function toClientLabel(row: RoaRow) {
  const name = String(row.nome_cliente ?? "").trim();
  const code = String(row.cod_cliente ?? "").trim();
  if (name && code) return `${name} (${code})`;
  return name || code || "—";
}

function toAssessorLabel(row: RoaRow) {
  const name = String(row.nome_assessor ?? "").trim();
  const code = String(row.assessor ?? "").trim();
  if (name && code) return `${name} (${code})`;
  return name || code || "—";
}

function formatMonthKey(month: string) {
  const [mm, yyyy] = String(month).split("/");
  if (!mm || !yyyy) return month;
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const idx = Number(mm) - 1;
  return labels[idx] ? `${labels[idx]}/${yyyy}` : month;
}

function parseThresholdInput(raw: string) {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function cellStyle(overrides: Record<string, unknown> = {}) {
  return {
    font: { name: "Calibri", sz: 11, color: { rgb: "1F2937" } },
    alignment: { vertical: "center", horizontal: "left" },
    border: {
      top: { style: "thin", color: { rgb: "E5E7EB" } },
      bottom: { style: "thin", color: { rgb: "E5E7EB" } },
      left: { style: "thin", color: { rgb: "E5E7EB" } },
      right: { style: "thin", color: { rgb: "E5E7EB" } },
    },
    ...overrides,
  };
}

export default function RoaClientes12mDash({
  selectedAssessorId = [],
  selectedTeam = [],
}: RoaClientes12mDashProps) {
  const [filterMode, setFilterMode] = useState<RoaFilterMode>("todos");
  const [thresholdInput, setThresholdInput] = useState("0,30");
  const [minBaseInput, setMinBaseInput] = useState("");
  const [onlyWithRevenue, setOnlyWithRevenue] = useState(true);
  const [tableSearch, setTableSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<RoaRow | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "base", direction: "desc" });
  const itemsPerPage = 25;

  const thresholdPct = parseThresholdInput(thresholdInput) ?? 0.3;
  const minBase = parseThresholdInput(minBaseInput);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode, thresholdInput, minBaseInput, onlyWithRevenue, tableSearch, selectedTeam, selectedAssessorId, sortConfig]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["roa-clientes-12m", selectedTeam, selectedAssessorId],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let assessorFilter: string[] | null =
        selectedAssessorId.length > 0 ? selectedAssessorId : null;

      if (!assessorFilter && selectedTeam.length > 0) {
        const { data: latestMvRows, error: latestMvError } = await supabase
          .from("mv_resumo_assessor" as any)
          .select("data_posicao")
          .order("data_posicao", { ascending: false })
          .limit(1);

        if (latestMvError) throw latestMvError;

        const latestMvDate = latestMvRows?.[0]?.data_posicao as string | undefined;
        if (!latestMvDate) return [] as RoaRow[];

        const { data: teamRows, error: teamError } = await supabase
          .from("mv_resumo_assessor" as any)
          .select("cod_assessor")
          .eq("data_posicao", latestMvDate)
          .in("time", selectedTeam);

        if (teamError) throw teamError;

        assessorFilter = Array.from(
          new Set(
            (teamRows || [])
              .map((row: any) => String(row.cod_assessor || "").toUpperCase())
              .filter(Boolean),
          ),
        );
      }

      const { data: rows, error: rowsError } = await supabase
        .rpc("rpc_get_roa_clientes_12m", { p_assessores: assessorFilter } as any)
        .select("*")
        .range(0, 30000);

      if (rowsError) throw rowsError;
      return (rows || []) as RoaRow[];
    },
  });

  const filteredRows = useMemo(() => {
    const search = tableSearch.trim().toLowerCase();
    return (data || []).filter((row) => {
      const roa = row.roa_invest_pct == null ? null : parseNumber(row.roa_invest_pct);
      const base = parseNumber(row.base_media_12m);
      const receita = parseNumber(row.receita_invest_12m);

      if (onlyWithRevenue && receita <= 0) return false;
      if (minBase != null && base < minBase) return false;

      if (filterMode === "abaixo") {
        if (roa == null || roa >= thresholdPct) return false;
      } else if (filterMode === "acima") {
        if (roa == null || roa <= thresholdPct) return false;
      }

      if (!search) return true;
      return (
        toClientLabel(row).toLowerCase().includes(search) ||
        toAssessorLabel(row).toLowerCase().includes(search) ||
        String(row.cod_cliente ?? "").includes(search) ||
        String(row.assessor ?? "").includes(search)
      );
    });
  }, [data, filterMode, thresholdPct, minBase, onlyWithRevenue, tableSearch]);

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    const direction = sortConfig.direction === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      if (sortConfig.key === "cliente") {
        return direction * toClientLabel(a).localeCompare(toClientLabel(b), "pt-BR");
      }
      if (sortConfig.key === "assessor") {
        return direction * toAssessorLabel(a).localeCompare(toAssessorLabel(b), "pt-BR");
      }
      if (sortConfig.key === "receita") {
        return direction * (parseNumber(a.receita_invest_12m) - parseNumber(b.receita_invest_12m));
      }
      if (sortConfig.key === "base") {
        return direction * (parseNumber(a.base_media_12m) - parseNumber(b.base_media_12m));
      }
      if (sortConfig.key === "net") {
        return direction * (parseNumber(a.net_atual) - parseNumber(b.net_atual));
      }
      if (sortConfig.key === "meses_receita") {
        return direction * ((a.meses_com_receita || 0) - (b.meses_com_receita || 0));
      }
      if (sortConfig.key === "meses_base") {
        return direction * ((a.meses_com_base || 0) - (b.meses_com_base || 0));
      }
      const aRoa = a.roa_invest_pct == null ? Number.POSITIVE_INFINITY : parseNumber(a.roa_invest_pct);
      const bRoa = b.roa_invest_pct == null ? Number.POSITIVE_INFINITY : parseNumber(b.roa_invest_pct);
      return direction * (aRoa - bRoa);
    });

    return rows;
  }, [filteredRows, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / itemsPerPage));
  const paginatedRows = useMemo(() => {
    const page = Math.min(currentPage, totalPages);
    const start = (page - 1) * itemsPerPage;
    return sortedRows.slice(start, start + itemsPerPage);
  }, [sortedRows, currentPage, totalPages, itemsPerPage]);

  const summary = useMemo(() => {
    const withRoa = sortedRows.filter((row) => row.roa_invest_pct != null);
    const receita = sortedRows.reduce((acc, row) => acc + parseNumber(row.receita_invest_12m), 0);
    const base = sortedRows.reduce((acc, row) => acc + parseNumber(row.base_media_12m), 0);
    const avgRoa =
      withRoa.length > 0
        ? withRoa.reduce((acc, row) => acc + parseNumber(row.roa_invest_pct), 0) / withRoa.length
        : 0;
    const janelaInicio = data?.[0]?.janela_inicio ?? null;
    const janelaFim = data?.[0]?.janela_fim ?? null;
    return {
      total: sortedRows.length,
      receita,
      base,
      avgRoa,
      janelaInicio,
      janelaFim,
    };
  }, [sortedRows, data]);

  const orderedMonths = useMemo(() => {
    const months = new Set<string>();
    (data || []).forEach((row) => {
      Object.keys(row.historico_receita || {}).forEach((m) => months.add(m));
      Object.keys(row.historico_net || {}).forEach((m) => months.add(m));
    });
    return Array.from(months).sort((a, b) => {
      const [ma, ya] = a.split("/").map(Number);
      const [mb, yb] = b.split("/").map(Number);
      return ya !== yb ? ya - yb : ma - mb;
    });
  }, [data]);

  const selectedClientMonths = useMemo(() => {
    if (!selectedClient) return [] as string[];
    const months = new Set<string>();
    Object.keys(selectedClient.historico_receita || {}).forEach((m) => months.add(m));
    Object.keys(selectedClient.historico_net || {}).forEach((m) => months.add(m));
    return Array.from(months).sort((a, b) => {
      const [ma, ya] = a.split("/").map(Number);
      const [mb, yb] = b.split("/").map(Number);
      return ya !== yb ? ya - yb : ma - mb;
    });
  }, [selectedClient]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      if (key === "cliente" || key === "assessor" || key === "roa") {
        return { key, direction: "asc" };
      }
      return { key, direction: "desc" };
    });
  };

  const downloadXlsx = () => {
    const title = "ROA Invest por Cliente • Janela 12 meses";
    const subtitle = `Fórmula: (Receita Investimentos 12m ÷ Base Média 12m) × 12 · Cross-sell (seguro/consórcio) fora · Filtro: ${
      filterMode === "todos" ? "todos" : `${filterMode} de ${formatPercent(thresholdPct)}`
    }`;
    const janela =
      summary.janelaInicio && summary.janelaFim
        ? `Período: ${summary.janelaInicio} a ${summary.janelaFim}`
        : "Período: últimos 12 meses";

    const headers = [
      "Código Cliente",
      "Nome Cliente",
      "Assessor",
      "Nome Assessor",
      "Receita Invest 12m",
      "Receita Líquida 12m",
      "Base Média 12m",
      "Net Atual",
      "ROA Invest %",
      "Meses c/ Receita",
      "Meses c/ Base",
      ...orderedMonths.map((m) => `Receita ${m}`),
      ...orderedMonths.map((m) => `Net ${m}`),
    ];

    const aoa: (string | number | null)[][] = [
      [title],
      [subtitle],
      [janela],
      [],
      headers,
    ];

    sortedRows.forEach((row) => {
      const historicoReceita = (row.historico_receita || {}) as Record<string, unknown>;
      const historicoNet = (row.historico_net || {}) as Record<string, unknown>;
      aoa.push([
        row.cod_cliente || "",
        row.nome_cliente || "",
        row.assessor || "",
        row.nome_assessor || "",
        parseNumber(row.receita_invest_12m),
        parseNumber(row.receita_liquida_12m),
        parseNumber(row.base_media_12m),
        parseNumber(row.net_atual),
        row.roa_invest_pct == null ? null : parseNumber(row.roa_invest_pct) / 100,
        row.meses_com_receita || 0,
        row.meses_com_base || 0,
        ...orderedMonths.map((m) => parseNumber(historicoReceita[m])),
        ...orderedMonths.map((m) => parseNumber(historicoNet[m])),
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
    ];
    worksheet["!freeze"] = { xSplit: 0, ySplit: 5 };
    worksheet["!cols"] = headers.map((header) => {
      if (header.includes("Nome")) return { wch: 28 };
      if (header.includes("Receita") || header.includes("Base") || header.includes("Net")) return { wch: 16 };
      if (header.includes("ROA")) return { wch: 12 };
      return { wch: 14 };
    });
    worksheet["!rows"] = [{ hpt: 24 }, { hpt: 18 }, { hpt: 18 }, { hpt: 8 }, { hpt: 22 }];

    const titleStyle = cellStyle({
      font: { name: "Calibri", sz: 16, bold: true, color: { rgb: "111827" } },
      fill: { patternType: "solid", fgColor: { rgb: "F8FAFC" } },
      alignment: { vertical: "center", horizontal: "left" },
      border: {},
    });
    const subtitleStyle = cellStyle({
      font: { name: "Calibri", sz: 10, italic: true, color: { rgb: "6B7280" } },
      fill: { patternType: "solid", fgColor: { rgb: "F8FAFC" } },
      border: {},
    });
    const headerStyle = cellStyle({
      font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "111827" } },
      fill: { patternType: "solid", fgColor: { rgb: "FACC15" } },
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
    });

    const moneyCols = new Set([4, 5, 6, 7]);
    const pctCol = 8;
    orderedMonths.forEach((_, idx) => {
      moneyCols.add(11 + idx);
      moneyCols.add(11 + orderedMonths.length + idx);
    });

    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    for (let r = 0; r <= range.e.r; r += 1) {
      for (let c = 0; c <= range.e.c; c += 1) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[addr];
        if (!cell) continue;

        if (r === 0) {
          cell.s = titleStyle;
          continue;
        }
        if (r === 1 || r === 2) {
          cell.s = subtitleStyle;
          continue;
        }
        if (r === 4) {
          cell.s = headerStyle;
          continue;
        }
        if (r < 5) continue;

        const dataRow = sortedRows[r - 5];
        const roaPct = dataRow?.roa_invest_pct == null ? null : parseNumber(dataRow.roa_invest_pct);
        const below = roaPct != null && roaPct < thresholdPct;
        const zebra = r % 2 === 0 ? "FFFFFF" : "F9FAFB";
        const fillRgb = below ? "FEF2F2" : zebra;
        const isRoa = c === pctCol;

        cell.s = cellStyle({
          fill: { patternType: "solid", fgColor: { rgb: isRoa && below ? "FECACA" : fillRgb } },
          font: {
            name: "Calibri",
            sz: 11,
            bold: isRoa,
            color: { rgb: isRoa && below ? "B91C1C" : "1F2937" },
          },
          alignment: {
            vertical: "center",
            horizontal: moneyCols.has(c) || isRoa || c >= 9 ? "right" : "left",
          },
        });

        if (moneyCols.has(c) && typeof cell.v === "number") {
          cell.t = "n";
          cell.z = '"R$"#,##0.00';
        }
        if (isRoa && typeof cell.v === "number") {
          cell.t = "n";
          cell.z = "0.00%";
        }
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ROA Clientes 12m");
    XLSX.writeFile(
      workbook,
      `roa_clientes_12m_${filterMode}_${String(thresholdPct).replace(".", ",")}.xlsx`,
    );
  };

  return (
    <div className="space-y-6">
      <LoadingOverlay isLoading={isLoading || isFetching} />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2 max-w-3xl">
          <h2 className="text-white font-display text-xl tracking-wide flex items-center gap-2">
            <Percent className="h-5 w-5 text-euro-gold" />
            ROA Invest por Cliente • 12 meses
          </h2>
          <p className="text-white/55 text-sm leading-relaxed">
            Receita de investimentos (demonstrativo) ÷ base média (positivador), anualizada.
            Seguro e consórcio ficam de fora. Use o filtro para achar clientes abaixo da meta
            (ex.: 0,30%) e baixe a base formatada.
          </p>
          <div className="inline-flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/45 font-data">
            <Info className="h-3.5 w-3.5 mt-0.5 text-euro-gold/70 shrink-0" />
            <span>
              ROA % = (Receita Invest 12m ÷ Base Média 12m) × 12 × 100 · Janela rolante dos últimos
              12 meses
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-end">
          <div className="space-y-1">
            <label className="text-[10px] font-data uppercase tracking-widest text-white/40">
              Limite ROA %
            </label>
            <Input
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              className="w-28 bg-white/5 border-white/15 text-white h-9"
              placeholder="0,30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-data uppercase tracking-widest text-white/40">
              Base mínima
            </label>
            <Input
              value={minBaseInput}
              onChange={(e) => setMinBaseInput(e.target.value)}
              className="w-36 bg-white/5 border-white/15 text-white h-9"
              placeholder="ex. 100000"
            />
          </div>

          <ToggleGroup
            type="single"
            value={filterMode}
            onValueChange={(v) => (v ? setFilterMode(v as RoaFilterMode) : null)}
            className="justify-start sm:justify-end"
          >
            <ToggleGroupItem value="abaixo" className="text-[10px] font-data uppercase tracking-widest">
              Abaixo
            </ToggleGroupItem>
            <ToggleGroupItem value="acima" className="text-[10px] font-data uppercase tracking-widest">
              Acima
            </ToggleGroupItem>
            <ToggleGroupItem value="todos" className="text-[10px] font-data uppercase tracking-widest">
              Todos
            </ToggleGroupItem>
          </ToggleGroup>

          <button
            type="button"
            onClick={() => setOnlyWithRevenue((v) => !v)}
            className={cn(
              "h-9 px-3 rounded-full border text-[10px] font-data uppercase tracking-widest transition-all",
              onlyWithRevenue
                ? "border-euro-gold/40 bg-euro-gold/10 text-euro-gold"
                : "border-white/15 bg-white/5 text-white/45 hover:text-white",
            )}
          >
            Só c/ receita
          </button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadXlsx}
            className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300 h-9"
            disabled={sortedRows.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar XLSX
          </Button>
        </div>
      </div>

      {error && (
        <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-8 text-center">
          <div className="text-white/60 font-data text-sm">Não foi possível carregar o ROA dos clientes.</div>
        </Card>
      )}

      {!isLoading && !error && (data || []).length === 0 && (
        <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-8 text-center">
          <div className="text-white/60 font-data text-sm">Nenhum cliente encontrado na janela de 12 meses.</div>
        </Card>
      )}

      {!isLoading && !error && (data || []).length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4">
              <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">Clientes no filtro</div>
              <div className="text-white font-display text-2xl mt-2">{summary.total.toLocaleString("pt-BR")}</div>
            </Card>
            <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4">
              <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">Receita Invest 12m</div>
              <div className="text-white font-display text-2xl mt-2">{formatCurrencyCompact(summary.receita)}</div>
            </Card>
            <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4">
              <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">Base Média (soma)</div>
              <div className="text-white font-display text-2xl mt-2">{formatCurrencyCompact(summary.base)}</div>
            </Card>
            <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4">
              <div className="text-white/55 font-data text-[10px] uppercase tracking-widest flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-euro-gold" />
                ROA médio filtrado
              </div>
              <div className="text-euro-gold font-display text-2xl mt-2">{formatPercent(summary.avgRoa)}</div>
            </Card>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
            <Input
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Buscar cliente ou assessor..."
              className="pl-9 bg-white/5 border-white/15 text-white"
            />
          </div>

          <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-euro-gold text-[#111827] text-[10px] font-data uppercase tracking-widest">
                    <th
                      onClick={() => toggleSort("cliente")}
                      className="py-3 px-4 text-left cursor-pointer hover:bg-euro-gold/80 min-w-[220px]"
                    >
                      Cliente
                    </th>
                    <th
                      onClick={() => toggleSort("assessor")}
                      className="py-3 px-4 text-left cursor-pointer hover:bg-euro-gold/80 min-w-[180px]"
                    >
                      Assessor
                    </th>
                    <th
                      onClick={() => toggleSort("receita")}
                      className="py-3 px-4 text-right cursor-pointer hover:bg-euro-gold/80"
                    >
                      Receita Invest 12m
                    </th>
                    <th
                      onClick={() => toggleSort("base")}
                      className="py-3 px-4 text-right cursor-pointer hover:bg-euro-gold/80"
                    >
                      Base Média 12m
                    </th>
                    <th
                      onClick={() => toggleSort("net")}
                      className="py-3 px-4 text-right cursor-pointer hover:bg-euro-gold/80"
                    >
                      Net Atual
                    </th>
                    <th
                      onClick={() => toggleSort("roa")}
                      className="py-3 px-4 text-right cursor-pointer hover:bg-euro-gold/80"
                    >
                      ROA Invest
                    </th>
                    <th
                      onClick={() => toggleSort("meses_receita")}
                      className="py-3 px-4 text-right cursor-pointer hover:bg-euro-gold/80"
                    >
                      Meses Rec.
                    </th>
                    <th
                      onClick={() => toggleSort("meses_base")}
                      className="py-3 px-4 text-right cursor-pointer hover:bg-euro-gold/80"
                    >
                      Meses Base
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => {
                    const roa = row.roa_invest_pct == null ? null : parseNumber(row.roa_invest_pct);
                    const below = roa != null && roa < thresholdPct;
                    return (
                      <tr
                        key={`${row.cod_cliente}-${row.assessor}`}
                        onClick={() => setSelectedClient(row)}
                        className={cn(
                          "border-b border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer",
                          below && "bg-red-500/[0.04]",
                        )}
                      >
                        <td className="py-3 px-4 text-white/90">{toClientLabel(row)}</td>
                        <td className="py-3 px-4 text-white/70">{toAssessorLabel(row)}</td>
                        <td className="py-3 px-4 text-right text-cyan-300/90">
                          {formatCurrency(parseNumber(row.receita_invest_12m))}
                        </td>
                        <td className="py-3 px-4 text-right text-white/80">
                          {formatCurrency(parseNumber(row.base_media_12m))}
                        </td>
                        <td className="py-3 px-4 text-right text-white/60">
                          {formatCurrency(parseNumber(row.net_atual))}
                        </td>
                        <td
                          className={cn(
                            "py-3 px-4 text-right font-medium",
                            below ? "text-red-300" : "text-euro-gold",
                          )}
                        >
                          {roa == null ? "—" : formatPercent(roa)}
                        </td>
                        <td className="py-3 px-4 text-right text-white/50">{row.meses_com_receita ?? 0}</td>
                        <td className="py-3 px-4 text-right text-white/50">{row.meses_com_base ?? 0}</td>
                      </tr>
                    );
                  })}
                  {paginatedRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-white/45 font-data text-sm">
                        Nenhum cliente no filtro atual.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {sortedRows.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-start gap-3 px-4 py-3 pr-28 sm:pr-36 border-t border-white/10 bg-euro-navy/50">
                <div className="text-xs text-white/50 font-data">
                  Mostrando{" "}
                  <span className="text-white/70">
                    {Math.min((Math.min(currentPage, totalPages) - 1) * itemsPerPage + 1, sortedRows.length)}
                  </span>{" "}
                  a{" "}
                  <span className="text-white/70">
                    {Math.min(Math.min(currentPage, totalPages) * itemsPerPage, sortedRows.length)}
                  </span>{" "}
                  de <span className="text-white/70">{sortedRows.length.toLocaleString("pt-BR")}</span> clientes
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1.5 rounded bg-euro-elevated border border-white/5 text-white/70 disabled:opacity-30 hover:border-euro-gold hover:text-euro-gold transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="text-xs text-white/70 font-data px-2">
                    Página {Math.min(currentPage, totalPages)} de {totalPages}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded bg-euro-elevated border border-white/5 text-white/70 disabled:opacity-30 hover:border-euro-gold hover:text-euro-gold transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>

          <Dialog open={!!selectedClient} onOpenChange={(open) => (!open ? setSelectedClient(null) : null)}>
            <DialogContent className="bg-[#0A0A0B] border-white/10 text-white sm:max-w-[980px] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white font-display text-lg tracking-wide">
                  {selectedClient ? toClientLabel(selectedClient) : "Detalhamento"}
                </DialogTitle>
              </DialogHeader>

              {selectedClient && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="bg-[#0F1218]/70 border-white/10 p-3">
                      <div className="text-[10px] font-data uppercase tracking-widest text-white/45">Assessor</div>
                      <div className="text-sm text-white/90 mt-1">{toAssessorLabel(selectedClient)}</div>
                    </Card>
                    <Card className="bg-[#0F1218]/70 border-white/10 p-3">
                      <div className="text-[10px] font-data uppercase tracking-widest text-white/45">Receita Invest 12m</div>
                      <div className="text-sm text-cyan-300 mt-1">
                        {formatCurrency(parseNumber(selectedClient.receita_invest_12m))}
                      </div>
                    </Card>
                    <Card className="bg-[#0F1218]/70 border-white/10 p-3">
                      <div className="text-[10px] font-data uppercase tracking-widest text-white/45">Base Média 12m</div>
                      <div className="text-sm text-white/90 mt-1">
                        {formatCurrency(parseNumber(selectedClient.base_media_12m))}
                      </div>
                    </Card>
                    <Card className="bg-[#0F1218]/70 border-white/10 p-3">
                      <div className="text-[10px] font-data uppercase tracking-widest text-white/45">ROA Invest</div>
                      <div className="text-sm text-euro-gold mt-1">
                        {selectedClient.roa_invest_pct == null
                          ? "—"
                          : formatPercent(parseNumber(selectedClient.roa_invest_pct))}
                      </div>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-[#0F1218]/70 backdrop-blur-xl border-white/10 overflow-hidden">
                      <div className="px-5 pt-4 pb-3 border-b border-white/10 flex items-center justify-between">
                        <div className="text-euro-gold font-data uppercase tracking-widest text-[11px]">
                          Receita mensal
                        </div>
                        <div className="text-white/65 font-data text-[11px] uppercase tracking-widest">
                          Total: {formatCurrencyCompact(parseNumber(selectedClient.receita_invest_12m))}
                        </div>
                      </div>
                      <div className="max-h-[45vh] overflow-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                            <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                              <th className="py-3 px-5 font-medium">Mês</th>
                              <th className="py-3 px-5 font-medium text-right">Receita</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {selectedClientMonths.map((month) => (
                              <tr key={`rec-${month}`} className="text-sm">
                                <td className="py-3 px-5 text-white/80 font-data text-xs">{formatMonthKey(month)}</td>
                                <td className="py-3 px-5 text-right text-white/85 font-data text-xs">
                                  {formatCurrency(parseNumber((selectedClient.historico_receita || {})[month]))}
                                </td>
                              </tr>
                            ))}
                            {selectedClientMonths.length === 0 && (
                              <tr>
                                <td colSpan={2} className="py-10 px-5 text-center text-white/45 font-data text-sm">
                                  Sem histórico de receita.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    <Card className="bg-[#0F1218]/70 backdrop-blur-xl border-white/10 overflow-hidden">
                      <div className="px-5 pt-4 pb-3 border-b border-white/10 flex items-center justify-between">
                        <div className="text-euro-gold font-data uppercase tracking-widest text-[11px]">
                          Net mensal
                        </div>
                        <div className="text-white/65 font-data text-[11px] uppercase tracking-widest">
                          Atual: {formatCurrencyCompact(parseNumber(selectedClient.net_atual))}
                        </div>
                      </div>
                      <div className="max-h-[45vh] overflow-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                            <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                              <th className="py-3 px-5 font-medium">Mês</th>
                              <th className="py-3 px-5 font-medium text-right">Net</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {selectedClientMonths.map((month) => (
                              <tr key={`net-${month}`} className="text-sm">
                                <td className="py-3 px-5 text-white/80 font-data text-xs">{formatMonthKey(month)}</td>
                                <td className="py-3 px-5 text-right text-white/85 font-data text-xs">
                                  {formatCurrency(parseNumber((selectedClient.historico_net || {})[month]))}
                                </td>
                              </tr>
                            ))}
                            {selectedClientMonths.length === 0 && (
                              <tr>
                                <td colSpan={2} className="py-10 px-5 text-center text-white/45 font-data text-sm">
                                  Sem histórico de net.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
