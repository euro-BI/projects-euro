/**
 * As tabelas de origem divergem no formato do código do assessor: dados_captacoes e
 * dados_positivador guardam sem o prefixo "A", enquanto dados_fp e
 * vw_transferencias_assessor guardam com. Estes helpers normalizam nos dois sentidos.
 */

export function stripAssessorPrefix(code: string) {
  const value = String(code ?? "").trim().toUpperCase();
  return value.startsWith("A") ? value.slice(1) : value;
}

export function withAssessorPrefix(code: string) {
  const value = String(code ?? "").trim().toUpperCase();
  if (!value) return value;
  return value.startsWith("A") ? value : `A${value}`;
}

/** `net_em_m` do positivador é texto com vírgula decimal. */
export function parseNetEmM(value: unknown) {
  return parseDecimal(value);
}

/** Campos monetários das tabelas de origem vêm como texto com vírgula. */
export function parseDecimal(value: unknown) {
  const parsed = Number(String(value ?? "0").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchInChunks(
  codes: string[],
  queryFn: (chunk: string[]) => Promise<{ data: unknown[] | null; error: { message: string } | null }>,
  chunkSize = 80,
): Promise<Record<string, unknown>[]> {
  const collected: Record<string, unknown>[] = [];
  for (let i = 0; i < codes.length; i += chunkSize) {
    const { data, error } = await queryFn(codes.slice(i, i + chunkSize));
    if (error) throw error;
    collected.push(...((data ?? []) as Record<string, unknown>[]));
  }
  return collected;
}
