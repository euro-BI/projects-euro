import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ClientDetailsDialog, type DetailColumn } from "./ClientDetailsDialog";
import { parseNetEmM, stripAssessorPrefix, withAssessorPrefix } from "./private-detail-utils";

const dadosPositivador = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase.from("dados_positivador" as any) as any;

const PAGE_SIZE = 1000;

type ClienteRow = {
  cliente: string | null;
  assessor: string | null;
  tipoPessoa: string | null;
  net: number;
};

/**
 * A MV conta um cliente em `total_clientes` quando está ATIVO e com net acima de
 * R$ 99,99, e soma `custodia_net` para qualquer net positivo. Aqui usamos o mesmo
 * corte de clientes para o total do modal bater com o KPI.
 */
const NET_MIN_CLIENTE = 99.99;

export function PrivateClientesDialog({
  children,
  selectedMonth,
  assessorCodes,
}: {
  children: React.ReactNode;
  selectedMonth: string;
  assessorCodes: string[];
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["private-clientes-detalhe", selectedMonth, assessorCodes],
    enabled: open && !!selectedMonth && assessorCodes.length > 0,
    queryFn: async () => {
      // dados_positivador guarda o assessor sem o prefixo "A" e data_posicao sempre no dia 1.
      const codes = assessorCodes.map(stripAssessorPrefix);
      const collected: Array<Record<string, unknown>> = [];

      for (let page = 0; ; page += 1) {
        const { data: rows, error } = await dadosPositivador()
          .select("assessor, cliente, net_em_m, tipo_pessoa")
          .eq("data_posicao", selectedMonth)
          .eq("status", "ATIVO")
          .in("assessor", codes)
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

        if (error) throw error;

        const batch = (rows ?? []) as Array<Record<string, unknown>>;
        collected.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }

      return collected
        .map<ClienteRow>((row) => ({
          cliente: (row.cliente as string) ?? null,
          assessor: withAssessorPrefix((row.assessor as string) ?? ""),
          tipoPessoa: (row.tipo_pessoa as string) ?? null,
          net: parseNetEmM(row.net_em_m),
        }))
        .filter((row) => row.net > NET_MIN_CLIENTE)
        .sort((a, b) => b.net - a.net);
    },
  });

  const rows = useMemo(() => data ?? [], [data]);

  const columns: DetailColumn<ClienteRow>[] = useMemo(
    () => [
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
        key: "tipoPessoa",
        label: "Tipo",
        sortValue: (row) => row.tipoPessoa ?? "",
        render: (row) => <span className="text-white/60">{row.tipoPessoa || "—"}</span>,
      },
      {
        key: "net",
        label: "Custódia (net)",
        align: "right",
        sortValue: (row) => row.net,
        render: (row) =>
          row.net.toLocaleString("pt-BR", {
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
      title="Clientes ativos por cliente"
      subtitle="Positivador do mês: status ATIVO e net acima de R$ 99,99, mesmo corte da mv_resumo_assessor"
      icon={Users}
      columns={columns}
      rows={rows}
      isLoading={isLoading}
      searchValue={(row) => `${row.cliente ?? ""} ${row.assessor ?? ""} ${row.tipoPessoa ?? ""}`}
      sumValue={(row) => row.net}
      sumLabel="Custódia somada"
      emptyMessage="Nenhum cliente ativo no período"
      xlsxName={`clientes_ativos_${selectedMonth}`}
      onOpenChange={setOpen}
    >
      {children}
    </ClientDetailsDialog>
  );
}
