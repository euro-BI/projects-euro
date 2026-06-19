import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ParetoMetric = "bruta" | "liquida";

type ParetoRow = {
  cod_cliente: string | null;
  receita_bruta_total: number | string | null;
  ranking_bruto: number | null;
  perc_receita_bruta: number | string | null;
  perc_acumulado_bruto: number | string | null;
  receita_liquida_total: number | string | null;
  ranking_liquido: number | null;
  perc_receita_liquida: number | string | null;
  perc_acumulado_liquido: number | string | null;
  classe_pareto_bruto: string | null;
  classe_pareto_liquido: string | null;
  historico_bruto: Record<string, number | string> | null;
  historico_liquido: Record<string, number | string> | null;
  nome_cliente?: string | null;
};

type SortKey =
  | "cliente"
  | "ranking"
  | "receita"
  | "perc_receita"
  | "perc_acumulado"
  | "classe";

type SortConfig = {
  key: SortKey;
  direction: "asc" | "desc";
};

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatCurrency(value: number, opts?: { maximumFractionDigits?: number }) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
  }).format(value);
}

function formatCurrencyCompact(value: number) {
  if (Math.abs(value) >= 1_000_000_000) return `${formatCurrency(value / 1_000_000_000, { maximumFractionDigits: 1 })} bi`.replace("R$", "R$ ");
  if (Math.abs(value) >= 1_000_000) return `${formatCurrency(value / 1_000_000, { maximumFractionDigits: 1 })} mi`.replace("R$", "R$ ");
  if (Math.abs(value) >= 1_000) return `${formatCurrency(value / 1_000, { maximumFractionDigits: 1 })} mil`.replace("R$", "R$ ");
  return formatCurrency(value);
}

function formatPercent(value: number, digits = 2) {
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}%`;
}

function toClientLabel(row: ParetoRow) {
  const name = String(row.nome_cliente ?? "").trim();
  const code = String(row.cod_cliente ?? "").trim();
  if (name && code) return `${name} (${code})`;
  return name || code || "—";
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function monthKeyToSortKey(monthKey: string) {
  const [m, y] = monthKey.split("/").map((p) => parseInt(p, 10));
  const year = Number.isFinite(y) ? y : 0;
  const month = Number.isFinite(m) ? m : 0;
  return year * 100 + month;
}

function formatMonthKey(monthKey: string) {
  const [m, y] = monthKey.split("/").map((p) => parseInt(p, 10));
  const year = Number.isFinite(y) ? y : 0;
  const month = Number.isFinite(m) ? m : 1;
  const date = new Date(year, Math.max(0, month - 1), 1);
  const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(date)
    .replace(".", "")
    .toLowerCase();
  return `${monthShort}/${year}`;
}

function getSortedMonthsFromHistorico(historico: Record<string, unknown> | null | undefined) {
  const keys = Object.keys(historico || {});
  keys.sort((a, b) => monthKeyToSortKey(a) - monthKeyToSortKey(b));
  return keys;
}

async function fetchClientNameMap(codes: string[]) {
  const map = new Map<string, string>();
  const cleanCodes = Array.from(new Set(codes.map((c) => String(c ?? "").trim()).filter(Boolean)));
  if (cleanCodes.length === 0) return map;

  const chunks = chunkArray(cleanCodes, 500);
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("vw_resumo_clientes_posicao" as any)
      .select("cod_cliente, nome_cliente")
      .in("cod_cliente", chunk)
      .range(0, 10000);

    if (error) continue;

    (data || []).forEach((row: any) => {
      const code = String(row?.cod_cliente ?? "").trim();
      const name = String(row?.nome_cliente ?? "").trim();
      if (!code || !name) return;
      if (!map.has(code)) map.set(code, name);
    });
  }

  return map;
}

export default function ParetoClientes12mDash() {
  const [metric, setMetric] = useState<ParetoMetric>("bruta");
  const [tableSearch, setTableSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "receita", direction: "desc" });
  const [selectedClient, setSelectedClient] = useState<ParetoRow | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pareto-clientes-12m"],
    queryFn: async () => {
      const { data: rows, error: rowsError } = await supabase
        .from("vw_pareto_clientes_12m" as any)
        .select("*")
        .range(0, 20000);

      if (rowsError) throw rowsError;

      const typedRows = (rows || []) as ParetoRow[];
      const codes = typedRows.map((r) => String(r.cod_cliente ?? "").trim()).filter(Boolean);
      const nameMap = await fetchClientNameMap(codes);

      return typedRows.map((row) => ({
        ...row,
        nome_cliente: nameMap.get(String(row.cod_cliente ?? "").trim()) || null,
      })) as ParetoRow[];
    },
  });

  const metricConfig = useMemo(() => {
    if (metric === "liquida") {
      return {
        title: "Receita Líquida",
        receitaKey: "receita_liquida_total" as const,
        rankingKey: "ranking_liquido" as const,
        percKey: "perc_receita_liquida" as const,
        acumuladoKey: "perc_acumulado_liquido" as const,
        classeKey: "classe_pareto_liquido" as const,
        historicoKey: "historico_liquido" as const,
      };
    }

    return {
      title: "Receita Bruta",
      receitaKey: "receita_bruta_total" as const,
      rankingKey: "ranking_bruto" as const,
      percKey: "perc_receita_bruta" as const,
      acumuladoKey: "perc_acumulado_bruto" as const,
      classeKey: "classe_pareto_bruto" as const,
      historicoKey: "historico_bruto" as const,
    };
  }, [metric]);

  const sortedBase = useMemo(() => {
    const rows = [...(data || [])];
    rows.sort((a, b) => parseNumber(b[metricConfig.receitaKey]) - parseNumber(a[metricConfig.receitaKey]));
    return rows;
  }, [data, metricConfig.receitaKey]);

  const summary = useMemo(() => {
    const totalClientes = sortedBase.length;
    const receitaTotal = sortedBase.reduce((acc, row) => acc + parseNumber(row[metricConfig.receitaKey]), 0);
    const top80Rows = sortedBase.filter((row) => String(row[metricConfig.classeKey] ?? "") === "A");
    const clientesTop80 = top80Rows.length;
    const receitaTop80 = top80Rows.reduce((acc, row) => acc + parseNumber(row[metricConfig.receitaKey]), 0);
    const percClientesTop80 = totalClientes > 0 ? (clientesTop80 / totalClientes) * 100 : 0;
    const classes = sortedBase.reduce(
      (acc, row) => {
        const c = String(row[metricConfig.classeKey] ?? "").trim() || "—";
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalClientes,
      clientesTop80,
      percClientesTop80,
      receitaTotal,
      receitaTop80,
      classes,
    };
  }, [sortedBase, metricConfig.receitaKey, metricConfig.classeKey]);

  const orderedMonths = useMemo(() => {
    const monthSet = new Set<string>();
    (data || []).forEach((row) => {
      const hist = row[metricConfig.historicoKey] as Record<string, unknown> | null;
      if (!hist) return;
      Object.keys(hist).forEach((k) => monthSet.add(k));
    });

    return getSortedMonthsFromHistorico(Object.fromEntries(Array.from(monthSet).map((k) => [k, 0])));
  }, [data, metricConfig.historicoKey]);

  const dialogSections = useMemo(() => {
    if (!selectedClient) {
      return {
        title: "",
        sections: [] as Array<{
          key: ParetoMetric;
          title: string;
          months: string[];
          historico: Record<string, unknown>;
          total: number;
        }>,
      };
    }

    const brutoHistorico = (selectedClient.historico_bruto || {}) as Record<string, unknown>;
    const liquidoHistorico = (selectedClient.historico_liquido || {}) as Record<string, unknown>;

    const brutoMonths = getSortedMonthsFromHistorico(brutoHistorico);
    const liquidoMonths = getSortedMonthsFromHistorico(liquidoHistorico);

    const brutoTotal = brutoMonths.reduce((acc, m) => acc + parseNumber(brutoHistorico[m]), 0);
    const liquidoTotal = liquidoMonths.reduce((acc, m) => acc + parseNumber(liquidoHistorico[m]), 0);

    const sections = [
      {
        key: "bruta" as const,
        title: "Receita Bruta",
        months: brutoMonths,
        historico: brutoHistorico,
        total: brutoTotal,
      },
      {
        key: "liquida" as const,
        title: "Receita Líquida",
        months: liquidoMonths,
        historico: liquidoHistorico,
        total: liquidoTotal,
      },
    ];

    if (metric === "liquida") sections.reverse();

    return {
      title: toClientLabel(selectedClient),
      sections,
    };
  }, [metric, selectedClient]);

  const filteredRows = useMemo(() => {
    const search = tableSearch.trim().toLowerCase();
    if (!search) return sortedBase;
    return sortedBase.filter((row) => {
      const label = toClientLabel(row).toLowerCase();
      return label.includes(search);
    });
  }, [sortedBase, tableSearch]);

  const sortedFilteredRows = useMemo(() => {
    const rows = [...filteredRows];
    rows.sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      if (sortConfig.key === "cliente") {
        return direction * toClientLabel(a).localeCompare(toClientLabel(b), "pt-BR", { sensitivity: "base" });
      }

      if (sortConfig.key === "classe") {
        const ca = String(a[metricConfig.classeKey] ?? "").trim();
        const cb = String(b[metricConfig.classeKey] ?? "").trim();
        return direction * ca.localeCompare(cb, "pt-BR", { sensitivity: "base" });
      }

      if (sortConfig.key === "ranking") {
        const ra = Number(a[metricConfig.rankingKey] ?? 0);
        const rb = Number(b[metricConfig.rankingKey] ?? 0);
        return direction * (ra - rb);
      }

      if (sortConfig.key === "receita") {
        return direction * (parseNumber(a[metricConfig.receitaKey]) - parseNumber(b[metricConfig.receitaKey]));
      }

      if (sortConfig.key === "perc_receita") {
        return direction * (parseNumber(a[metricConfig.percKey]) - parseNumber(b[metricConfig.percKey]));
      }

      return direction * (parseNumber(a[metricConfig.acumuladoKey]) - parseNumber(b[metricConfig.acumuladoKey]));
    });

    if (sortConfig.key === "ranking" && sortConfig.direction === "asc") return rows;
    if (sortConfig.key !== "ranking" && sortConfig.direction === "desc") return rows;
    return rows;
  }, [
    filteredRows,
    sortConfig.direction,
    sortConfig.key,
    metricConfig.receitaKey,
    metricConfig.percKey,
    metricConfig.acumuladoKey,
    metricConfig.rankingKey,
    metricConfig.classeKey,
  ]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      if (key === "ranking") return { key, direction: "asc" };
      if (key === "cliente") return { key, direction: "asc" };
      return { key, direction: "desc" };
    });
  };

  const downloadXlsx = () => {
    const rows = sortedFilteredRows.map((row) => {
      const historico = (row[metricConfig.historicoKey] || {}) as Record<string, unknown>;
      const base: Record<string, unknown> = {
        "Código Cliente": row.cod_cliente || "",
        "Nome Cliente": row.nome_cliente || "",
        Cliente: toClientLabel(row),
        Ranking: row[metricConfig.rankingKey] ?? "",
        Classe: row[metricConfig.classeKey] ?? "",
        "Receita Total": parseNumber(row[metricConfig.receitaKey]),
        "% Receita": parseNumber(row[metricConfig.percKey]),
        "% Acumulado": parseNumber(row[metricConfig.acumuladoKey]),
      };

      orderedMonths.forEach((month) => {
        base[month] = parseNumber(historico?.[month]);
      });

      return base;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pareto");
    XLSX.writeFile(workbook, `pareto_clientes_12m_${metric}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1">
          <h2 className="text-white font-display text-xl tracking-wide flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-euro-gold" />
            Pareto de Clientes • Últimos 12 meses
          </h2>
          <p className="text-white/45 font-data text-[11px] uppercase tracking-widest">
            Selecione receita bruta ou líquida e exporte a base detalhada
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
          <ToggleGroup
            type="single"
            value={metric}
            onValueChange={(v) => (v ? setMetric(v as ParetoMetric) : null)}
            className="justify-start sm:justify-end"
          >
            <ToggleGroupItem value="bruta" className="text-[10px] font-data uppercase tracking-widest">
              Bruta
            </ToggleGroupItem>
            <ToggleGroupItem value="liquida" className="text-[10px] font-data uppercase tracking-widest">
              Líquida
            </ToggleGroupItem>
          </ToggleGroup>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadXlsx}
            className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold transition-all duration-300"
            disabled={sortedFilteredRows.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            XLSX
          </Button>
        </div>
      </div>

      {isLoading && (
        <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-8 text-center">
          <div className="text-white/60 font-data text-sm">Carregando Pareto...</div>
        </Card>
      )}

      {!isLoading && error && (
        <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-8 text-center">
          <div className="text-white/60 font-data text-sm">Não foi possível carregar o Pareto.</div>
        </Card>
      )}

      {!isLoading && !error && (data || []).length === 0 && (
        <Card className="bg-[#0F1218]/60 backdrop-blur-xl border-white/10 p-8 text-center">
          <div className="text-white/60 font-data text-sm">Nenhum dado encontrado na view.</div>
        </Card>
      )}

      {!isLoading && !error && (data || []).length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4">
              <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">Total de Clientes</div>
              <div className="text-white font-display text-2xl mt-2">{summary.totalClientes.toLocaleString("pt-BR")}</div>
            </Card>

            <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4">
              <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">Clientes no Top 80%</div>
              <div className="text-white font-display text-2xl mt-2">{summary.clientesTop80.toLocaleString("pt-BR")}</div>
            </Card>

            <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4">
              <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">% de Clientes (Pareto)</div>
              <div className="text-white font-display text-2xl mt-2">{formatPercent(summary.percClientesTop80, 1)}</div>
            </Card>

            <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4">
              <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">Receita Total</div>
              <div className="text-white font-display text-2xl mt-2">{formatCurrencyCompact(summary.receitaTotal)}</div>
            </Card>

            <Card className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4">
              <div className="text-white/55 font-data text-[10px] uppercase tracking-widest">Receita Top 80%</div>
              <div className="text-white font-display text-2xl mt-2">{formatCurrencyCompact(summary.receitaTop80)}</div>
              <div className="text-white/40 font-data text-[10px] uppercase tracking-widest mt-2">
                A: {summary.classes.A ?? 0} • B: {summary.classes.B ?? 0} • C: {summary.classes.C ?? 0}
              </div>
            </Card>
          </div>

          <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative flex flex-col">
            <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent pointer-events-none opacity-20" />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-6 pt-5 pb-4 relative z-10">
              <h3 className="text-lg font-data text-euro-gold tracking-widest uppercase">
                Tabela detalhada
              </h3>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-72 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-euro-gold transition-colors" />
                  <Input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-white/30 focus:border-euro-gold/50 transition-all h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 pb-4 flex flex-wrap items-center gap-3 text-[11px] font-data uppercase tracking-widest text-white/60 relative z-10">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Registros: {sortedFilteredRows.length.toLocaleString("pt-BR")}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Receita: {formatCurrencyCompact(sortedFilteredRows.reduce((acc, row) => acc + parseNumber(row[metricConfig.receitaKey]), 0))}
              </span>
            </div>

            <div className="overflow-auto flex-grow relative min-h-[320px] max-h-[520px] z-10">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                    <th onClick={() => toggleSort("ranking")} className="py-4 px-4 font-bold cursor-pointer hover:bg-euro-gold/80 transition-colors w-[90px]">
                      Ranking
                    </th>
                    <th onClick={() => toggleSort("cliente")} className="py-4 px-4 font-bold cursor-pointer hover:bg-euro-gold/80 transition-colors min-w-[280px]">
                      Cliente
                    </th>
                    <th onClick={() => toggleSort("receita")} className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors min-w-[160px]">
                      {metricConfig.title}
                    </th>
                    <th onClick={() => toggleSort("perc_receita")} className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors min-w-[120px]">
                      % Receita
                    </th>
                    <th onClick={() => toggleSort("perc_acumulado")} className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-euro-gold/80 transition-colors min-w-[120px]">
                      % Acumulado
                    </th>
                    <th onClick={() => toggleSort("classe")} className="py-4 px-4 font-bold text-center cursor-pointer hover:bg-euro-gold/80 transition-colors w-[90px]">
                      Classe
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {sortedFilteredRows.map((row, index) => {
                    const receita = parseNumber(row[metricConfig.receitaKey]);
                    const perc = parseNumber(row[metricConfig.percKey]);
                    const acum = parseNumber(row[metricConfig.acumuladoKey]);
                    const classe = String(row[metricConfig.classeKey] ?? "").trim() || "—";
                    const ranking = Number(row[metricConfig.rankingKey] ?? index + 1);

                    return (
                      <tr
                        key={`${row.cod_cliente || "cliente"}-${index}`}
                        className="text-sm hover:bg-white/[0.03] transition-colors cursor-pointer"
                        onClick={() => setSelectedClient(row)}
                      >
                        <td className="py-3 px-4 text-white/80 font-data text-xs">
                          {ranking ? ranking.toLocaleString("pt-BR") : "—"}
                        </td>
                        <td className="py-3 px-4 text-white/85 font-data text-xs">
                          <div className="flex flex-col">
                            <span className="text-white/90">{toClientLabel(row)}</span>
                            <span className="text-white/40 text-[10px] uppercase tracking-widest">
                              {row.cod_cliente || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-white/85 font-data text-xs">
                          {formatCurrency(receita)}
                        </td>
                        <td className="py-3 px-4 text-right text-white/75 font-data text-xs">
                          {formatPercent(perc, 2)}
                        </td>
                        <td className="py-3 px-4 text-right text-white/75 font-data text-xs">
                          {formatPercent(acum, 2)}
                        </td>
                        <td className="py-3 px-4 text-center font-data text-xs">
                          <span
                            className={
                              classe === "A"
                                ? "text-emerald-300"
                                : classe === "B"
                                  ? "text-amber-300"
                                  : classe === "C"
                                    ? "text-rose-300"
                                    : "text-white/60"
                            }
                          >
                            {classe}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedFilteredRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 px-4 text-center text-white/45 font-data text-sm">
                        Nenhum cliente encontrado para esta busca.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Dialog open={!!selectedClient} onOpenChange={(open) => (!open ? setSelectedClient(null) : null)}>
            <DialogContent className="bg-[#0A0A0B] border-white/10 text-white sm:max-w-[980px] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white font-display text-lg tracking-wide">
                  {dialogSections.title || "Detalhamento"}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dialogSections.sections.map((section) => (
                  <Card key={section.key} className="bg-[#0F1218]/70 backdrop-blur-xl border-white/10 overflow-hidden">
                    <div className="px-5 pt-4 pb-3 border-b border-white/10 flex items-center justify-between">
                      <div className="text-euro-gold font-data uppercase tracking-widest text-[11px]">
                        {section.title}
                      </div>
                      <div className="text-white/65 font-data text-[11px] uppercase tracking-widest">
                        Total: {formatCurrencyCompact(section.total)}
                      </div>
                    </div>

                    <div className="max-h-[55vh] overflow-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-[#0A0A0B]">
                          <tr className="text-[10px] font-data uppercase tracking-widest text-white/55 border-b border-white/10">
                            <th className="py-3 px-5 font-medium">Mês</th>
                            <th className="py-3 px-5 font-medium text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                          {section.months.map((month) => (
                            <tr key={`${section.key}-${month}`} className="text-sm">
                              <td className="py-3 px-5 text-white/80 font-data text-xs">{formatMonthKey(month)}</td>
                              <td className="py-3 px-5 text-right text-white/85 font-data text-xs">
                                {formatCurrency(parseNumber(section.historico[month]))}
                              </td>
                            </tr>
                          ))}
                          {section.months.length === 0 && (
                            <tr>
                              <td colSpan={2} className="py-10 px-5 text-center text-white/45 font-data text-sm">
                                Sem histórico para este cliente.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
