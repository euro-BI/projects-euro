import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format, parseISO } from "date-fns";
import { Coins } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { REVENUE_PRODUCTS } from "@/utils/cockpit-v2-mappers";
import { ClientDetailsDialog, type DetailColumn } from "./ClientDetailsDialog";
import {
  fetchInChunks,
  parseDecimal,
  stripAssessorPrefix,
  withAssessorPrefix,
} from "./private-detail-utils";

const fromTable = (table: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase.from(table as any) as any;

type ReceitaRow = {
  data: string | null;
  cliente: string | null;
  assessor: string | null;
  detalhe: string;
  valor: number;
};

const PRODUCT_LABEL = Object.fromEntries(
  [...REVENUE_PRODUCTS.eurostock, ...REVENUE_PRODUCTS.affare].map((product) => [
    product.key,
    product.label,
  ]),
);

function monthBounds(selectedMonth: string) {
  const start = parseISO(selectedMonth);
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(addMonths(start, 1), "yyyy-MM-dd"),
    prevStart: format(addMonths(start, -1), "yyyy-MM-dd"),
    key: selectedMonth.slice(0, 7),
  };
}

function nextMonthDay(selectedMonth: string, day: number) {
  const start = parseISO(selectedMonth);
  return format(addMonths(start, 1), "yyyy-MM") + `-${String(day).padStart(2, "0")}`;
}

async function loadRevenueRows(
  productKey: string,
  selectedMonth: string,
  assessorCodes: string[],
): Promise<ReceitaRow[]> {
  const bounds = monthBounds(selectedMonth);
  const codesA = assessorCodes.map(withAssessorPrefix);
  const codesRaw = assessorCodes.map(stripAssessorPrefix);

  switch (productKey) {
    case "rf": {
      const rows = await fetchInChunks(codesA, (chunk) =>
        fromTable("dados_rf_fluxo")
          .select("data, cod_assessor, cod_conta, tipo_operacao, receita_a_dividir, nome_papel")
          .gte("data", bounds.start)
          .lt("data", bounds.end)
          .in("cod_assessor", chunk),
      );
      return rows
        .map((row) => {
          const tipo = String(row.tipo_operacao ?? "").toUpperCase().trim();
          return {
            data: (row.data as string) ?? null,
            cliente: (row.cod_conta as string) ?? null,
            assessor: withAssessorPrefix((row.cod_assessor as string) ?? ""),
            detalhe: `${tipo || "RF"} · ${row.nome_papel ?? ""}`.trim(),
            valor: parseDecimal(row.receita_a_dividir) / 2,
          };
        })
        .filter((row) => {
          const tipo = row.detalhe.toUpperCase();
          return (tipo.includes("APLICAÇÃO") || tipo.includes("RESGATE")) && Math.abs(row.valor) >= 0.01;
        });
    }

    case "cetipados": {
      const rows = await fetchInChunks([...codesA, ...codesRaw], (chunk) =>
        fromTable("dados_cetipados")
          .select("data, assessor, cliente, fundo, receita_estimada")
          .gte("data", bounds.start)
          .lt("data", bounds.end)
          .in("assessor", chunk),
      );
      const allowed = new Set([...codesA, ...codesRaw]);
      return rows
        .filter((row) => allowed.has(withAssessorPrefix((row.assessor as string) ?? "")))
        .map((row) => ({
          data: (row.data as string) ?? null,
          cliente: (row.cliente as string) ?? null,
          assessor: withAssessorPrefix((row.assessor as string) ?? ""),
          detalhe: String(row.fundo ?? "Cetipado"),
          valor: parseDecimal(row.receita_estimada),
        }))
        .filter((row) => Math.abs(row.valor) >= 0.01);
    }

    case "ofertas": {
      const [ofertasRf, fundos] = await Promise.all([
        fetchInChunks(codesA, (chunk) =>
          fromTable("dados_ofertas")
            .select(
              "codigo_aai, status_solicitacao_reserva, data_liquidacao_prevista, cliente, oferta, fee, valor_solicitado",
            )
            .gte("data_liquidacao_prevista", bounds.start)
            .lte("data_liquidacao_prevista", nextMonthDay(selectedMonth, 7))
            .in("codigo_aai", chunk),
        ),
        (async () => {
          const { data, error } = await fromTable("dados_fundos_novo")
            .select("data_liquidacao, fee, assessor, cliente, nome_oferta, valor_qtde_reserva, status_reserva")
            .gte("data_liquidacao", bounds.start)
            .lte("data_liquidacao", nextMonthDay(selectedMonth, 5));
          if (error) throw error;
          return data ?? [];
        })(),
      ]);

      const allowed = new Set(codesA);
      const rfRows = ofertasRf
        .map((row) => {
          const dataLiq = row.data_liquidacao_prevista as string | null;
          const dia = dataLiq ? parseISO(dataLiq).getDate() : 1;
          const ref = dataLiq
            ? format(addMonths(parseISO(dataLiq), dia <= 7 ? -1 : 0), "yyyy-MM")
            : bounds.key;
          const status = String(row.status_solicitacao_reserva ?? "").toUpperCase();
          return {
            data: dataLiq,
            cliente: (row.cliente as string) ?? null,
            assessor: withAssessorPrefix((row.codigo_aai as string) ?? ""),
            detalhe: `Oferta RF · ${row.oferta ?? ""}`.trim(),
            valor: (0.7 * parseDecimal(row.fee) / 100) * parseDecimal(row.valor_solicitado),
            keep: ref === bounds.key && !status.includes("CANCEL"),
          };
        })
        .filter((row) => row.keep && allowed.has(row.assessor) && Math.abs(row.valor) >= 0.01);

      const fundoRows = (fundos as Array<Record<string, unknown>>)
        .map((row) => {
          const assessor = withAssessorPrefix((row.assessor as string) ?? "");
          const dataLiq = row.data_liquidacao as string | null;
          const dia = dataLiq ? parseISO(dataLiq).getDate() : 8;
          const ref = dataLiq
            ? format(addMonths(parseISO(dataLiq), dia <= 5 ? -1 : 0), "yyyy-MM")
            : bounds.key;
          const status = String(row.status_reserva ?? "").toUpperCase();
          const ok = status === "EFETIVADO" || status === "EM PROCESSAMENTO" || status === "SOLICITADO";
          return {
            data: dataLiq,
            cliente: (row.cliente as string) ?? null,
            assessor,
            detalhe: `Oferta fundo · ${row.nome_oferta ?? ""}`.trim(),
            valor: (parseDecimal(row.fee) / 100) * 0.7 * parseDecimal(row.valor_qtde_reserva),
            keep: ok && ref === bounds.key && allowed.has(assessor),
          };
        })
        .filter((row) => row.keep && Math.abs(row.valor) >= 0.01);

      return [...rfRows, ...fundoRows].map(({ keep: _keep, ...row }) => row);
    }

    case "offshore": {
      const [ops, remessas] = await Promise.all([
        fetchInChunks(codesA, (chunk) =>
          fromTable("dados_offshore_operacoes")
            .select("date, cod_conta_brasil, valor_receita_usd, cod_assessor")
            .gte("date", bounds.start)
            .lt("date", bounds.end)
            .in("cod_assessor", chunk),
        ),
        fetchInChunks(codesA, (chunk) =>
          fromTable("dados_offshore_remessas")
            .select("date, valor_ordem_remessa_rs, taxa_percentual_spread, cod_assessor")
            .gte("date", bounds.start)
            .lt("date", bounds.end)
            .in("cod_assessor", chunk),
        ),
      ]);

      return [
        ...ops.map((row) => ({
          data: (row.date as string) ?? null,
          cliente: (row.cod_conta_brasil as string) ?? null,
          assessor: withAssessorPrefix((row.cod_assessor as string) ?? ""),
          detalhe: "Operação offshore",
          valor: parseDecimal(row.valor_receita_usd),
        })),
        ...remessas.map((row) => ({
          data: (row.date as string) ?? null,
          cliente: null,
          assessor: withAssessorPrefix((row.cod_assessor as string) ?? ""),
          detalhe: "Remessa offshore",
          valor: parseDecimal(row.valor_ordem_remessa_rs) * (parseDecimal(row.taxa_percentual_spread) / 100),
        })),
      ].filter((row) => Math.abs(row.valor) >= 0.01);
    }

    case "cambio_pf":
    case "cambio": {
      const pessoa = productKey === "cambio_pf" ? "PF" : "PJ";
      const rows = await fetchInChunks([...codesA, ...codesRaw], (chunk) =>
        fromTable("dados_cambio")
          .select("data, assessor, receita_a_dividir, tp_pessoa, dt_mn_cli")
          .gte("data", bounds.start)
          .lt("data", bounds.end)
          .in("assessor", chunk),
      );
      return rows
        .filter((row) => {
          const tipo = String(row.tp_pessoa ?? "").toUpperCase();
          const isPf = tipo.includes("FÍSICA") || tipo.includes("FISICA") || tipo === "PF";
          return productKey === "cambio_pf" ? isPf : !isPf;
        })
        .map((row) => ({
          data: (row.data as string) ?? null,
          cliente: (row.dt_mn_cli as string) ?? null,
          assessor: withAssessorPrefix((row.assessor as string) ?? ""),
          detalhe: `Câmbio ${pessoa}`,
          valor: parseDecimal(row.receita_a_dividir),
        }))
        .filter((row) => Math.abs(row.valor) >= 0.01);
    }

    case "b3": {
      const rows = await fetchInChunks(codesRaw, (chunk) =>
        fromTable("dados_positivador")
          .select("assessor, cliente, receita_bovespa, receita_futuros, data_posicao")
          .eq("data_posicao", selectedMonth)
          .in("assessor", chunk),
      );
      return rows
        .map((row) => ({
          data: selectedMonth,
          cliente: (row.cliente as string) ?? null,
          assessor: withAssessorPrefix((row.assessor as string) ?? ""),
          detalhe: "Bovespa × 0,75 + Futuros × 0,70",
          valor: parseDecimal(row.receita_bovespa) * 0.75 + parseDecimal(row.receita_futuros) * 0.7,
        }))
        .filter((row) => Math.abs(row.valor) >= 0.01);
    }

    case "estruturadas": {
      const rows = await fetchInChunks([...codesA, ...codesRaw], (chunk) =>
        fromTable("dados_rv_executadas")
          .select("data_inclusao, codigo_cliente, comissao, assessor_da_operacao, ativo, estrutura")
          .gte("data_inclusao", bounds.start)
          .lt("data_inclusao", bounds.end)
          .in("assessor_da_operacao", chunk),
      );
      return rows
        .map((row) => ({
          data: (row.data_inclusao as string) ?? null,
          cliente: (row.codigo_cliente as string) ?? null,
          assessor: withAssessorPrefix((row.assessor_da_operacao as string) ?? ""),
          detalhe: String(row.estrutura || row.ativo || "Estruturada"),
          valor: parseDecimal(String(row.comissao ?? "0").replace(/[^\d,.-]/g, "")),
        }))
        .filter((row) => Math.abs(row.valor) >= 0.01);
    }

    case "seguros": {
      const rows = await fetchInChunks(codesA, (chunk) =>
        fromTable("dados_seguros_novo")
          .select("data_inicial, cliente, conta, cod_assessor, produto, valor_comissao")
          .gte("data_inicial", bounds.start)
          .lt("data_inicial", bounds.end)
          .in("cod_assessor", chunk),
      );
      return rows
        .map((row) => ({
          data: (row.data_inicial as string) ?? null,
          cliente: (row.cliente as string) || (row.conta as string) || null,
          assessor: withAssessorPrefix((row.cod_assessor as string) ?? ""),
          detalhe: String(row.produto ?? "Seguro"),
          valor: Number(row.valor_comissao) || 0,
        }))
        .filter((row) => Math.abs(row.valor) >= 0.01);
    }

    case "consorcios": {
      const rows = await fetchInChunks(codesA, (chunk) =>
        fromTable("vw_dados_consorcio_comissoes")
          .select("data_vencimento, cliente, codigo_cliente, cod_assessor, produto, valor_comissao_mensal")
          .gte("data_vencimento", bounds.start)
          .lt("data_vencimento", bounds.end)
          .in("cod_assessor", chunk),
      );
      return rows
        .map((row) => ({
          data: (row.data_vencimento as string) ?? null,
          cliente: (row.cliente as string) || (row.codigo_cliente as string) || null,
          assessor: withAssessorPrefix((row.cod_assessor as string) ?? ""),
          detalhe: String(row.produto ?? "Consórcio"),
          valor: Number(row.valor_comissao_mensal) || 0,
        }))
        .filter((row) => Math.abs(row.valor) >= 0.01);
    }

    case "asset":
    case "previdencia": {
      const competencia = productKey === "asset" ? bounds.prevStart : bounds.start;
      const rows = await fetchInChunks(codesA, (chunk) =>
        fromTable("dados_demonstrativo")
          .select("data, produto, categoria, cod_cliente, comissao_bruta_rs_escritorio, cod_assessor_direto")
          .eq("data", competencia)
          .in("cod_assessor_direto", chunk),
      );
      const needle = productKey === "asset" ? "ASSET" : "PREVID";
      return rows
        .filter((row) => {
          const blob = `${row.produto ?? ""} ${row.categoria ?? ""}`.toUpperCase();
          return blob.includes(needle);
        })
        .map((row) => ({
          data: (row.data as string) ?? null,
          cliente: (row.cod_cliente as string) ?? null,
          assessor: withAssessorPrefix((row.cod_assessor_direto as string) ?? ""),
          detalhe: String(row.produto || row.categoria || productKey),
          valor: parseDecimal(row.comissao_bruta_rs_escritorio),
        }))
        .filter((row) => Math.abs(row.valor) >= 0.01);
    }

    case "compromissadas_pj": {
      const rows = await fetchInChunks(codesA, (chunk) =>
        fromTable("dados_pj_custodia")
          .select("data_foto_custodia, codigo_assessor, receita_acruada_a_dividir, cod_conta")
          .gte("data_foto_custodia", bounds.start)
          .lt("data_foto_custodia", bounds.end)
          .in("codigo_assessor", chunk),
      );
      return rows
        .map((row) => ({
          data: (row.data_foto_custodia as string) ?? null,
          cliente: (row.cod_conta as string) ?? null,
          assessor: withAssessorPrefix((row.codigo_assessor as string) ?? ""),
          detalhe: "Compromissada PJ",
          valor: parseDecimal(row.receita_acruada_a_dividir),
        }))
        .filter((row) => Math.abs(row.valor) >= 0.01);
    }

    default:
      return [];
  }
}

export function PrivateReceitaDialog({
  children,
  productKey,
  selectedMonth,
  assessorCodes,
}: {
  children: React.ReactNode;
  productKey: string;
  selectedMonth: string;
  assessorCodes: string[];
}) {
  const [open, setOpen] = useState(false);
  const label = PRODUCT_LABEL[productKey] ?? productKey;

  const { data, isLoading } = useQuery({
    queryKey: ["private-receita-detalhe", productKey, selectedMonth, assessorCodes],
    enabled: open && !!selectedMonth && assessorCodes.length > 0,
    queryFn: () => loadRevenueRows(productKey, selectedMonth, assessorCodes),
  });

  const rows = useMemo(() => data ?? [], [data]);

  const columns: DetailColumn<ReceitaRow>[] = useMemo(
    () => [
      {
        key: "data",
        label: "Data",
        sortValue: (row) => row.data ?? "",
        exportValue: (row) => row.data,
        render: (row) => (row.data ? format(parseISO(row.data), "dd/MM/yyyy") : "—"),
      },
      {
        key: "cliente",
        label: "Cliente",
        sortValue: (row) => row.cliente ?? "",
        render: (row) => <span className="text-white">{row.cliente || "—"}</span>,
      },
      {
        key: "assessor",
        label: "Assessor",
        sortValue: (row) => row.assessor ?? "",
        render: (row) => row.assessor || "—",
      },
      {
        key: "detalhe",
        label: "Detalhe",
        sortValue: (row) => row.detalhe,
        render: (row) => <span className="text-white/60">{row.detalhe || "—"}</span>,
      },
      {
        key: "valor",
        label: "Receita",
        align: "right",
        sortValue: (row) => row.valor,
        render: (row) =>
          row.valor.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 2,
          }),
      },
    ],
    [],
  );

  return (
    <ClientDetailsDialog
      title={`Receita ${label} por cliente`}
      subtitle="Linhas da origem do produto no mês selecionado. A soma tenta fechar com o card; Asset, Previdência e Compromissadas podem divergir da MV."
      icon={Coins}
      columns={columns}
      rows={rows}
      isLoading={isLoading}
      searchValue={(row) => `${row.cliente ?? ""} ${row.assessor ?? ""} ${row.detalhe}`}
      sumValue={(row) => row.valor}
      emptyMessage="Nenhum lançamento nesta categoria no período"
      xlsxName={`receita_${productKey}_${selectedMonth}`}
      onOpenChange={setOpen}
    >
      {children}
    </ClientDetailsDialog>
  );
}
