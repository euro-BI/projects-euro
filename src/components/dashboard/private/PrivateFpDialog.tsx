import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ClientDetailsDialog, type DetailColumn } from "./ClientDetailsDialog";
import { parseNetEmM, stripAssessorPrefix, withAssessorPrefix } from "./private-detail-utils";

const dadosPositivador = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase.from("dados_positivador" as any) as any;

const dadosFp = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase.from("dados_fp" as any) as any;

const PAGE_SIZE = 1000;

/** Piso de net que define o universo elegível PF 300K+, igual à mv_resumo_assessor. */
const NET_ELEGIVEL = 300_000;

function contaKeys(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const stripped = raw.replace(/^0+/, "") || "0";
  return [...new Set([raw, raw.toUpperCase(), stripped, stripped.toUpperCase()])];
}

function lookupConta<T>(map: Map<string, T>, value: string) {
  for (const key of contaKeys(value)) {
    const found = map.get(key);
    if (found !== undefined) return found;
  }
  return undefined;
}

type FpRow = {
  cliente: string;
  assessor: string | null;
  net: number | null;
  temFp: boolean;
};

export function PrivateFpDialog({
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
    queryKey: ["private-fp-detalhe", selectedMonth, assessorCodes],
    enabled: open && !!selectedMonth && assessorCodes.length > 0,
    queryFn: async () => {
      const codesSemPrefixo = assessorCodes.map(stripAssessorPrefix);
      const codesComPrefixo = assessorCodes.map(withAssessorPrefix);

      // Positivador do mês: serve tanto o universo 300K+ quanto o net das contas de FP.
      const positivador: Array<Record<string, unknown>> = [];
      for (let page = 0; ; page += 1) {
        const { data: rows, error } = await dadosPositivador()
          .select("assessor, cliente, net_em_m, tipo_pessoa")
          .eq("data_posicao", selectedMonth)
          .eq("status", "ATIVO")
          .in("assessor", codesSemPrefixo)
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

        if (error) throw error;
        const batch = (rows ?? []) as Array<Record<string, unknown>>;
        positivador.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }

      type PosEntry = { cliente: string; assessor: string; net: number; tipoPessoa: string };
      const porConta = new Map<string, PosEntry>();
      const indexPos = (entry: PosEntry) => {
        for (const key of contaKeys(entry.cliente)) porConta.set(key, entry);
      };
      for (const row of positivador) {
        const cliente = String(row.cliente ?? "").trim();
        if (!cliente) continue;
        indexPos({
          cliente,
          assessor: withAssessorPrefix((row.assessor as string) ?? ""),
          net: parseNetEmM(row.net_em_m),
          tipoPessoa: String(row.tipo_pessoa ?? ""),
        });
      }

      // Numerador: contas PF 300K+ com o FP 100% preenchido.
      const { data: fpRows, error: fpError } = await dadosFp()
        .select("cod_assessor, cod_conta")
        .eq("periodo", selectedMonth)
        .eq("completude", 100)
        .eq("segmento_conta", "PF 300K+")
        .in("cod_assessor", codesComPrefixo);

      if (fpError) throw fpError;

      const fpAccounts: Array<{ conta: string; assessor: string }> = [];
      const comFp = new Map<string, string>();
      for (const row of (fpRows ?? []) as Array<Record<string, unknown>>) {
        const conta = String(row.cod_conta ?? "").trim();
        if (!conta) continue;
        const assessor = withAssessorPrefix((row.cod_assessor as string) ?? "");
        fpAccounts.push({ conta, assessor });
        for (const key of contaKeys(conta)) comFp.set(key, assessor);
      }

      const missingFpCodes = fpAccounts.map((item) => item.conta).filter((conta) => !lookupConta(porConta, conta));
      if (missingFpCodes.length > 0) {
        for (let i = 0; i < missingFpCodes.length; i += 80) {
          const chunk = missingFpCodes.slice(i, i + 80);
          const { data: extra, error } = await dadosPositivador()
            .select("assessor, cliente, net_em_m, tipo_pessoa")
            .eq("data_posicao", selectedMonth)
            .in("cliente", chunk);
          if (error) throw error;
          for (const row of (extra ?? []) as Array<Record<string, unknown>>) {
            const cliente = String(row.cliente ?? "").trim();
            if (!cliente) continue;
            indexPos({
              cliente,
              assessor: withAssessorPrefix((row.assessor as string) ?? ""),
              net: parseNetEmM(row.net_em_m),
              tipoPessoa: String(row.tipo_pessoa ?? ""),
            });
          }
        }
      }

      const merged = new Map<string, FpRow>();
      const vistos = new Set<string>();

      for (const row of porConta.values()) {
        if (vistos.has(row.cliente)) continue;
        vistos.add(row.cliente);
        const isPf = row.tipoPessoa.toUpperCase().includes("FÍSICA") || row.tipoPessoa.toUpperCase().includes("FISICA");
        if (!isPf || row.net <= NET_ELEGIVEL) continue;
        merged.set(row.cliente, {
          cliente: row.cliente,
          assessor: row.assessor,
          net: row.net,
          temFp: Boolean(lookupConta(comFp, row.cliente)),
        });
      }

      return [...merged.values()].sort((a, b) => {
        if (a.temFp !== b.temFp) return a.temFp ? 1 : -1;
        return (b.net ?? 0) - (a.net ?? 0);
      });
    },
  });

  const rows = useMemo(() => data ?? [], [data]);

  const subtitle = useMemo(() => {
    if (isLoading) return "Carregando...";
    const comFp = rows.filter((row) => row.temFp).length;
    const elegiveis = rows.filter((row) => row.net !== null).length;
    const pct = elegiveis > 0 ? (comFp / elegiveis) * 100 : 0;
    return `${comFp} de ${elegiveis} clientes PF com net acima de R$ 300 mil e FP completo (${pct.toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })}%)`;
  }, [rows, isLoading]);

  const columns: DetailColumn<FpRow>[] = useMemo(
    () => [
      {
        key: "cliente",
        label: "Cliente",
        sortValue: (row) => row.cliente,
        render: (row) => <span className="text-white">{row.cliente}</span>,
      },
      {
        key: "assessor",
        label: "Assessor",
        sortValue: (row) => row.assessor ?? "",
        render: (row) => row.assessor || "—",
      },
      {
        key: "net",
        label: "Custódia (net)",
        align: "right",
        sortValue: (row) => row.net ?? -1,
        render: (row) =>
          row.net === null
            ? "—"
            : row.net.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: 0,
              }),
      },
      {
        key: "temFp",
        label: "Financial Planning",
        sortValue: (row) => (row.temFp ? "Completo" : "Sem FP"),
        exportValue: (row) => (row.temFp ? "Completo" : "Sem FP"),
        render: (row) => (
          <span className={row.temFp ? "text-emerald-400" : "text-white/40"}>
            {row.temFp ? "Completo" : "Sem FP"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <ClientDetailsDialog
      title="Cobertura Financial Planning"
      subtitle={subtitle}
      icon={ClipboardCheck}
      columns={columns}
      rows={rows}
      isLoading={isLoading}
      searchValue={(row) =>
        `${row.cliente} ${row.assessor ?? ""} ${row.temFp ? "Completo" : "Sem FP"}`
      }
      emptyMessage="Nenhum cliente elegível no período"
      xlsxName={`cobertura_fp_${selectedMonth}`}
      onOpenChange={setOpen}
    >
      {children}
    </ClientDetailsDialog>
  );
}
