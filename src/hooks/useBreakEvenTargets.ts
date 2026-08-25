import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BreakEvenTargetRow = {
  id: string;
  competencia: string;
  product_key: string;
  value: number;
};

export const BREAK_EVEN_GROUPS = {
  rendaFixa: ["rf", "ofertas", "cetipados", "offshore"],
  rendaVariavel: ["estruturadas"],
  consorcios: ["consorcios"],
  seguros: ["seguros"],
} as const;

export function buildBreakEvenMap(rows: BreakEvenTargetRow[] | undefined | null) {
  const m = new Map<string, number>();
  (rows || []).forEach((row) => {
    const monthKey = String(row.competencia || "").slice(0, 7);
    if (!monthKey || !row.product_key) return;
    m.set(`${monthKey}|${row.product_key}`, Number(row.value) || 0);
  });
  return m;
}

export function getBreakEvenProduct(
  map: Map<string, number>,
  monthKey: string,
  productKey: string
) {
  return map.get(`${monthKey}|${productKey}`) ?? 0;
}

export function getBreakEvenSum(
  map: Map<string, number>,
  monthKey: string,
  productKeys: readonly string[]
) {
  return productKeys.reduce((acc, key) => acc + getBreakEvenProduct(map, monthKey, key), 0);
}

export function metaReceitaShare(value: number, universe: Array<{ meta_receita?: number }>) {
  const total = universe.reduce((acc, item) => acc + (Number(item.meta_receita) || 0), 0);
  if (total <= 0) return 0;
  return (Number(value) || 0) / total;
}

export function useBreakEvenTargets(year: string) {
  const query = useQuery({
    queryKey: ["dashboard-breakeven-targets", year],
    enabled: !!year,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("dashboard_breakeven_targets" as any) as any)
        .select("id, competencia, product_key, value")
        .gte("competencia", `${year}-01-01`)
        .lte("competencia", `${year}-12-31`)
        .order("competencia", { ascending: true });

      if (error) throw error;
      return (data || []) as BreakEvenTargetRow[];
    },
  });

  const map = useMemo(() => buildBreakEvenMap(query.data), [query.data]);

  return {
    ...query,
    map,
    getProduct: (monthKey: string, productKey: string) => getBreakEvenProduct(map, monthKey, productKey),
    getSum: (monthKey: string, productKeys: readonly string[]) => getBreakEvenSum(map, monthKey, productKeys),
  };
}
