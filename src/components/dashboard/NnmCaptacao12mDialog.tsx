import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ArrowUpRight, ArrowDownRight, ArrowRightLeft, FileSpreadsheet } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import {
  aggregateNnmMonthly,
  downloadNnmCaptacaoXlsx,
  rolling12MonthWindow,
  type NnmDetailRow,
  type NnmMonthlyRow,
} from "@/lib/export-nnm-captacao-xlsx";
import { cn } from "@/lib/utils";

type Props = {
  selectedTeam?: string[];
  selectedAssessorId?: string[];
  triggerClassName?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonth(mes: string) {
  try {
    return format(parseISO(`${mes}-01`), "MMM/yyyy", { locale: ptBR });
  } catch {
    return mes;
  }
}

function MonthlyTable({
  rows,
  columns,
}: {
  rows: NnmMonthlyRow[];
  columns: Array<{ key: keyof NnmMonthlyRow | "entradas_total" | "saidas_total"; label: string; tone?: string }>;
}) {
  const totals = useMemo(() => {
    const acc: Record<string, number> = {};
    columns.forEach((col) => {
      if (col.key === "mes") return;
      acc[col.key] = rows.reduce((sum, row) => {
        if (col.key === "entradas_total") return sum + row.entradas_cap + row.entradas_transf;
        if (col.key === "saidas_total") return sum + row.saidas_cap + row.saidas_transf;
        return sum + Number(row[col.key as keyof NnmMonthlyRow] || 0);
      }, 0);
    });
    return acc;
  }, [rows, columns]);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-euro-gold text-[#111827] text-[10px] font-data uppercase tracking-widest">
            {columns.map((col) => (
              <th key={col.key} className={cn("py-3 px-4", col.key === "mes" ? "text-left" : "text-right")}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.mes} className="border-b border-white/5 hover:bg-white/[0.03]">
              {columns.map((col) => {
                let value: number | string = "";
                if (col.key === "mes") value = formatMonth(row.mes);
                else if (col.key === "entradas_total") value = row.entradas_cap + row.entradas_transf;
                else if (col.key === "saidas_total") value = row.saidas_cap + row.saidas_transf;
                else value = Number(row[col.key as keyof NnmMonthlyRow] || 0);

                return (
                  <td
                    key={`${row.mes}-${col.key}`}
                    className={cn(
                      "py-2.5 px-4 font-data",
                      col.key === "mes" ? "text-left text-white/80" : "text-right",
                      col.tone,
                    )}
                  >
                    {col.key === "mes" ? value : formatCurrency(Number(value))}
                  </td>
                );
              })}
            </tr>
          ))}
          {rows.length > 0 && (
            <tr className="bg-euro-gold/10 border-t border-euro-gold/20">
              {columns.map((col) => (
                <td
                  key={`total-${col.key}`}
                  className={cn(
                    "py-3 px-4 font-data font-bold",
                    col.key === "mes" ? "text-left text-euro-gold" : "text-right text-white",
                  )}
                >
                  {col.key === "mes" ? "TOTAL" : formatCurrency(totals[col.key] || 0)}
                </td>
              ))}
            </tr>
          )}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center text-white/40 font-data text-sm">
                Sem dados no período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function NnmCaptacao12mDialog({
  selectedTeam = [],
  selectedAssessorId = [],
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const window12 = useMemo(() => rolling12MonthWindow(new Date()), []);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["nnm-captacao-12m", selectedTeam, selectedAssessorId, window12.startStr],
    enabled: open,
    queryFn: async () => {
      let summaryQuery = supabase
        .from("mv_resumo_assessor" as any)
        .select(
          "data_posicao, cod_assessor, nome_assessor, time, captacao_entradas, captacao_saidas, captacao_entrada_transf, captacao_saida_transf, captacao_liquida, captacao_transf_liquida, captacao_liquida_total",
        )
        .gte("data_posicao", window12.startStr)
        .lt("data_posicao", window12.endExclusiveStr);

      if (selectedTeam.length > 0) summaryQuery = summaryQuery.in("time", selectedTeam);
      if (selectedAssessorId.length > 0) summaryQuery = summaryQuery.in("cod_assessor", selectedAssessorId);

      const { data: summaryRows, error: summaryError } = await summaryQuery;
      if (summaryError) throw summaryError;

      let detailQuery = supabase
        .from("vw_captacao_detalhada" as any)
        .select(
          "mes_ref, cod_assessor, nome_assessor, cod_cliente, tipo_pessoa, captacao_entradas, captacao_saidas, captacao_liquida, captacao_entrada_transf, captacao_saida_transf, captacao_transf_liquida, captacao_liquida_total",
        )
        .gte("mes_ref", window12.startStr)
        .lt("mes_ref", window12.endExclusiveStr)
        .order("mes_ref", { ascending: true })
        .limit(20000);

      if (selectedAssessorId.length > 0) {
        detailQuery = detailQuery.in("cod_assessor", selectedAssessorId);
      }

      const { data: detailRows, error: detailError } = await detailQuery;
      if (detailError) throw detailError;

      let filteredDetail = (detailRows || []) as any[];

      // Se filtrou só por time, restringe detalhe aos assessores do resumo.
      if (selectedTeam.length > 0 && selectedAssessorId.length === 0) {
        const assessorsInTeam = new Set(
          (summaryRows || [])
            .map((r: any) => String(r.cod_assessor || "").toUpperCase())
            .filter(Boolean),
        );
        filteredDetail = filteredDetail.filter((r) =>
          assessorsInTeam.has(String(r.cod_assessor || "").toUpperCase()),
        );
      }

      const monthly = aggregateNnmMonthly((summaryRows || []) as any[]);
      const detail: NnmDetailRow[] = filteredDetail.map((row) => ({
        mes: String(row.mes_ref || "").slice(0, 7),
        cod_assessor: row.cod_assessor || "",
        nome_assessor: row.nome_assessor || "",
        cod_cliente: row.cod_cliente || "",
        tipo_pessoa: row.tipo_pessoa || null,
        entradas_cap: Number(row.captacao_entradas) || 0,
        saidas_cap: Number(row.captacao_saidas) || 0,
        liquida_cap: Number(row.captacao_liquida) || 0,
        entradas_transf: Number(row.captacao_entrada_transf) || 0,
        saidas_transf: Number(row.captacao_saida_transf) || 0,
        liquida_transf: Number(row.captacao_transf_liquida) || 0,
        liquida_total: Number(row.captacao_liquida_total) || 0,
      }));

      return { monthly, detail };
    },
  });

  const monthly = data?.monthly || [];
  const detail = data?.detail || [];

  const kpi = useMemo(() => {
    const entradas = monthly.reduce((a, r) => a + r.entradas_cap + r.entradas_transf, 0);
    const saidas = monthly.reduce((a, r) => a + r.saidas_cap + r.saidas_transf, 0);
    const liquido = monthly.reduce((a, r) => a + r.liquida_total, 0);
    return { entradas, saidas, liquido };
  }, [monthly]);

  const handleDownload = () => {
    downloadNnmCaptacaoXlsx({
      monthly,
      detail,
      janelaLabel: window12.label,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold h-8",
            triggerClassName,
          )}
        >
          <FileSpreadsheet className="h-3.5 w-3.5 mr-2" />
          NNM 12m
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-[#0A0A0B] border-white/10 text-white sm:max-w-[980px] max-h-[88vh] overflow-y-auto">
        <LoadingOverlay isLoading={isLoading || isFetching} />
        <DialogHeader>
          <DialogTitle className="text-white font-display text-lg tracking-wide flex items-center justify-between gap-3 pr-6">
            <span>NNM Captação · Últimos 12 meses</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={monthly.length === 0}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar XLSX
            </Button>
          </DialogTitle>
          <p className="text-white/45 text-xs font-data uppercase tracking-widest">
            {window12.label} · Cap e Transf separados · Entradas / Saídas / Líquido
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Card className="bg-[#0F1218]/70 border-white/10 p-4">
            <div className="flex items-center gap-2 text-[10px] font-data uppercase tracking-widest text-emerald-300/80">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Entradas (Cap + Transf)
            </div>
            <div className="text-xl font-display text-white mt-2">{formatCurrency(kpi.entradas)}</div>
          </Card>
          <Card className="bg-[#0F1218]/70 border-white/10 p-4">
            <div className="flex items-center gap-2 text-[10px] font-data uppercase tracking-widest text-red-300/80">
              <ArrowDownRight className="w-3.5 h-3.5" />
              Saídas (Cap + Transf)
            </div>
            <div className="text-xl font-display text-white mt-2">{formatCurrency(kpi.saidas)}</div>
          </Card>
          <Card className="bg-[#0F1218]/70 border-white/10 p-4">
            <div className="flex items-center gap-2 text-[10px] font-data uppercase tracking-widest text-euro-gold/80">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Líquido Total
            </div>
            <div className="text-xl font-display text-euro-gold mt-2">{formatCurrency(kpi.liquido)}</div>
          </Card>
        </div>

        <Tabs defaultValue="entradas" className="space-y-4">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="entradas" className="text-[10px] font-data uppercase tracking-widest">
              Entradas
            </TabsTrigger>
            <TabsTrigger value="saidas" className="text-[10px] font-data uppercase tracking-widest">
              Saídas
            </TabsTrigger>
            <TabsTrigger value="liquido" className="text-[10px] font-data uppercase tracking-widest">
              Líquido
            </TabsTrigger>
            <TabsTrigger value="detalhado" className="text-[10px] font-data uppercase tracking-widest">
              Detalhado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entradas">
            <MonthlyTable
              rows={monthly}
              columns={[
                { key: "mes", label: "Mês" },
                { key: "entradas_cap", label: "Cap", tone: "text-emerald-300/90" },
                { key: "entradas_transf", label: "Transf", tone: "text-cyan-300/90" },
                { key: "entradas_total", label: "Total", tone: "text-euro-gold" },
              ]}
            />
          </TabsContent>

          <TabsContent value="saidas">
            <MonthlyTable
              rows={monthly}
              columns={[
                { key: "mes", label: "Mês" },
                { key: "saidas_cap", label: "Cap", tone: "text-red-300/90" },
                { key: "saidas_transf", label: "Transf", tone: "text-orange-300/90" },
                { key: "saidas_total", label: "Total", tone: "text-euro-gold" },
              ]}
            />
          </TabsContent>

          <TabsContent value="liquido">
            <MonthlyTable
              rows={monthly}
              columns={[
                { key: "mes", label: "Mês" },
                { key: "liquida_cap", label: "Líq. Cap", tone: "text-emerald-300/90" },
                { key: "liquida_transf", label: "Líq. Transf", tone: "text-cyan-300/90" },
                { key: "liquida_total", label: "Líq. Total", tone: "text-euro-gold" },
              ]}
            />
          </TabsContent>

          <TabsContent value="detalhado">
            <div className="overflow-x-auto rounded-xl border border-white/10 max-h-[42vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-euro-gold text-[#111827] text-[10px] font-data uppercase tracking-widest">
                    <th className="py-3 px-3 text-left">Mês</th>
                    <th className="py-3 px-3 text-left">Assessor</th>
                    <th className="py-3 px-3 text-left">Cliente</th>
                    <th className="py-3 px-3 text-right">Ent. Cap</th>
                    <th className="py-3 px-3 text-right">Saí. Cap</th>
                    <th className="py-3 px-3 text-right">Ent. Transf</th>
                    <th className="py-3 px-3 text-right">Saí. Transf</th>
                    <th className="py-3 px-3 text-right">Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.slice(0, 400).map((row, idx) => (
                    <tr key={`${row.mes}-${row.cod_assessor}-${row.cod_cliente}-${idx}`} className="border-b border-white/5">
                      <td className="py-2 px-3 text-white/70 font-data text-xs">{formatMonth(row.mes)}</td>
                      <td className="py-2 px-3 text-white/80 text-xs">
                        {row.nome_assessor || row.cod_assessor}
                      </td>
                      <td className="py-2 px-3 text-white/70 text-xs">{row.cod_cliente}</td>
                      <td className="py-2 px-3 text-right text-emerald-300/80 font-data text-xs">
                        {formatCurrency(row.entradas_cap)}
                      </td>
                      <td className="py-2 px-3 text-right text-red-300/80 font-data text-xs">
                        {formatCurrency(row.saidas_cap)}
                      </td>
                      <td className="py-2 px-3 text-right text-cyan-300/80 font-data text-xs">
                        {formatCurrency(row.entradas_transf)}
                      </td>
                      <td className="py-2 px-3 text-right text-orange-300/80 font-data text-xs">
                        {formatCurrency(row.saidas_transf)}
                      </td>
                      <td className="py-2 px-3 text-right text-euro-gold font-data text-xs">
                        {formatCurrency(row.liquida_total)}
                      </td>
                    </tr>
                  ))}
                  {detail.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-white/40 font-data text-sm">
                        Sem linhas detalhadas no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {detail.length > 400 && (
              <p className="text-[11px] font-data text-white/40 mt-2">
                Mostrando 400 de {detail.length.toLocaleString("pt-BR")} linhas. O XLSX traz a base completa.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
