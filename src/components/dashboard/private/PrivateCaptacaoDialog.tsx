import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format, parseISO } from "date-fns";
import { Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ClientDetailsDialog, type DetailColumn } from "./ClientDetailsDialog";
import { stripAssessorPrefix, withAssessorPrefix } from "./private-detail-utils";

// Nenhuma das duas fontes existe nos tipos gerados do Supabase.
const dadosCaptacoes = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase.from("dados_captacoes" as any) as any;

const vwTransferencias = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase.from("vw_transferencias_assessor" as any) as any;

/**
 * Recortes disponíveis, espelhando os KPIs do card de Captação.
 * A MV monta cada um a partir de dados_captacoes (exceto WEALTH/TRANSF) somado
 * às transferências de vw_transferencias_assessor.
 */
export type CaptacaoKind = "bruta" | "saidas" | "liquida" | "nnm" | "pf" | "pj" | "transferencias";

type CaptacaoRow = {
  origem: "captacao" | "transferencia";
  data: string | null;
  cliente: string | null;
  assessor: string | null;
  tipo: string;
  valor: number;
};

const CAPTACAO_LABEL: Record<CaptacaoKind, { title: string; subtitle: string }> = {
  bruta: {
    title: "Captação Bruta por cliente",
    subtitle: "Entradas (crédito) em dados_captacoes, exceto WEALTH e TRANSF",
  },
  saidas: {
    title: "Saídas por cliente",
    subtitle: "Débitos em dados_captacoes, exceto WEALTH e TRANSF",
  },
  liquida: {
    title: "Captação Líquida por cliente",
    subtitle: "Créditos e débitos de dados_captacoes mais as transferências do mês",
  },
  nnm: {
    title: "Net New Money por cliente",
    subtitle: "Créditos e débitos de dados_captacoes, sem transferências",
  },
  pf: {
    title: "Captação Líquida PF por cliente",
    subtitle: "Movimentos de pessoa física, incluindo transferências",
  },
  pj: {
    title: "Captação Líquida PJ por cliente",
    subtitle: "Movimentos de pessoa jurídica, incluindo transferências",
  },
  transferencias: {
    title: "Transferências por cliente",
    subtitle: "Entradas e saídas de vw_transferencias_assessor",
  },
};

/** Recortes que somam transferências ao resultado, igual à MV. */
const INCLUDES_TRANSFERS: Record<CaptacaoKind, boolean> = {
  bruta: false,
  saidas: false,
  nnm: false,
  liquida: true,
  pf: true,
  pj: true,
  transferencias: true,
};

export function PrivateCaptacaoDialog({
  children,
  kind,
  selectedMonth,
  assessorCodes,
}: {
  children: React.ReactNode;
  kind: CaptacaoKind;
  selectedMonth: string;
  assessorCodes: string[];
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["private-captacao-detalhe", kind, selectedMonth, assessorCodes],
    enabled: open && !!selectedMonth && assessorCodes.length > 0,
    queryFn: async () => {
      const start = parseISO(selectedMonth);
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(addMonths(start, 1), "yyyy-MM-dd");

      const rows: CaptacaoRow[] = [];

      if (kind !== "transferencias") {
        // dados_captacoes guarda o assessor sem o prefixo "A".
        const codes = assessorCodes.map(stripAssessorPrefix);

        // A MV descarta WEALTH e TRANSF; o PostgREST não tem NOT IN, daí os dois neq.
        let query = dadosCaptacoes()
          .select("cod_assessor, cod_cliente, aux, valor_captacao, data_captacao, tipo_pessoa")
          .neq("tipo_captacao", "WEALTH")
          .neq("tipo_captacao", "TRANSF")
          .in("cod_assessor", codes)
          .gte("data_captacao", startStr)
          .lt("data_captacao", endStr);

        if (kind === "bruta") query = query.eq("aux", "C");
        if (kind === "saidas") query = query.eq("aux", "D");
        if (kind === "pf") query = query.eq("tipo_pessoa", "PESSOA FÍSICA");
        if (kind === "pj") query = query.neq("tipo_pessoa", "PESSOA FÍSICA");

        const { data: captacoes, error } = await query;
        if (error) throw error;

        for (const row of (captacoes ?? []) as Array<Record<string, unknown>>) {
          rows.push({
            origem: "captacao",
            data: (row.data_captacao as string) ?? null,
            cliente: (row.cod_cliente as string) ?? null,
            assessor: withAssessorPrefix((row.cod_assessor as string) ?? ""),
            tipo: row.aux === "C" ? "Entrada" : "Saída",
            valor: Number(row.valor_captacao) || 0,
          });
        }
      }

      if (INCLUDES_TRANSFERS[kind]) {
        // A view já entrega o assessor com prefixo "A" e o valor com sinal.
        const { data: transfers, error } = await vwTransferencias()
          .select("cod_assessor, cod_cliente, data_transferencia, tipo, valor")
          .in("cod_assessor", assessorCodes.map(withAssessorPrefix))
          .gte("data_transferencia", startStr)
          .lt("data_transferencia", endStr);

        if (error) throw error;

        for (const row of (transfers ?? []) as Array<Record<string, unknown>>) {
          const valor = Number(row.valor) || 0;
          rows.push({
            origem: "transferencia",
            data: (row.data_transferencia as string) ?? null,
            cliente: (row.cod_cliente as string) ?? null,
            assessor: (row.cod_assessor as string) ?? null,
            tipo: valor >= 0 ? "Transf. entrada" : "Transf. saída",
            valor,
          });
        }
      }

      return rows;
    },
  });

  const rows = useMemo(() => data ?? [], [data]);
  const labels = CAPTACAO_LABEL[kind];

  const columns: DetailColumn<CaptacaoRow>[] = useMemo(
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
        key: "tipo",
        label: "Tipo",
        sortValue: (row) => row.tipo,
        render: (row) => <span className="text-white/60">{row.tipo}</span>,
      },
      {
        key: "valor",
        label: "Valor",
        align: "right",
        sortValue: (row) => row.valor,
        render: (row) => (
          <span className={row.valor >= 0 ? "text-emerald-400" : "text-rose-400"}>
            {row.valor.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <ClientDetailsDialog
      title={labels.title}
      subtitle={labels.subtitle}
      icon={Wallet}
      columns={columns}
      rows={rows}
      isLoading={isLoading}
      searchValue={(row) => `${row.cliente ?? ""} ${row.assessor ?? ""} ${row.tipo}`}
      sumValue={(row) => row.valor}
      emptyMessage="Nenhuma movimentação no período"
      xlsxName={`captacao_${kind}_${selectedMonth}`}
      onOpenChange={setOpen}
    >
      {children}
    </ClientDetailsDialog>
  );
}
