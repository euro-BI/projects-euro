import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const BATCH_SIZE = 500;

type IncomingRow = Record<string, unknown>;

type TransferenciaRow = {
  cod_cliente: string | null;
  cod_assessor_origem: string | null;
  cod_assessor_destino: string | null;
  data_solicitacao: string | null;
  data_transferencia: string;
  status: string;
  cod_solicitacao: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function pick(row: IncomingRow, ...keys: string[]) {
  const entries = Object.entries(row);
  for (const key of keys) {
    const wanted = normalizeHeader(key);
    const hit = entries.find(([name]) => normalizeHeader(name) === wanted);
    if (hit && hit[1] != null && hit[1] !== "") return hit[1];
  }
  return null;
}

function normalizeHeader(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function dateInSaoPaulo(value: Date) {
  return value.toLocaleDateString("en-CA", { timeZone: "UTC" });
}

function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return dateInSaoPaulo(value);
  if (typeof value === "number" && Number.isFinite(value)) {
    return dateInSaoPaulo(new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000));
  }
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return dateInSaoPaulo(parsed);
  return null;
}

function normalizeAssessor(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw === "-") return "-";
  const digits = raw.toUpperCase().replace(/^A/, "").replace(/\D/g, "");
  return digits ? `A${digits}` : null;
}

function toStringValue(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const raw = String(value).trim();
  return raw || null;
}

function normalizeStatus(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && error.message) {
    return String(error.message);
  }
  return "Erro inesperado";
}

function mapRow(row: IncomingRow): TransferenciaRow | null {
  const status = normalizeStatus(pick(row, "status", "Status"));
  const codSolicitacao = toStringValue(pick(row, "cod_solicitacao", "Código Solicitação", "Codigo Solicitacao"));
  const dataTransferencia = parseDate(pick(row, "data_transferencia", "Data Transferência", "Data Transferencia"));
  if (status !== "CONCLUIDO" || !codSolicitacao || codSolicitacao === "0" || !dataTransferencia) return null;

  return {
    cod_cliente: toStringValue(pick(row, "cod_cliente", "Código do Cliente", "Codigo do Cliente")),
    cod_assessor_origem: normalizeAssessor(pick(row, "cod_assessor_origem", "Código Assessor Origem", "Codigo Assessor Origem")),
    cod_assessor_destino: normalizeAssessor(pick(row, "cod_assessor_destino", "Código Assessor Destino", "Codigo Assessor Destino")),
    data_solicitacao: parseDate(pick(row, "data_solicitacao", "Data Solicitação", "Data Solicitacao")),
    data_transferencia: dataTransferencia,
    status: "CONCLUIDO",
    cod_solicitacao: codSolicitacao,
  };
}

function dedupeRows(rows: TransferenciaRow[]) {
  const seen = new Map<string, TransferenciaRow>();
  for (const row of rows) seen.set(row.cod_solicitacao, row);
  return [...seen.values()];
}

async function fetchExistingSolicitacoes(
  supabase: ReturnType<typeof createClient>,
  codes: string[],
): Promise<Set<string>> {
  const existing = new Set<string>();
  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const chunk = codes.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("dados_transferencias")
      .select("cod_solicitacao")
      .in("cod_solicitacao", chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.cod_solicitacao) existing.add(String(row.cod_solicitacao));
    }
  }
  return existing;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Use POST" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "JWT obrigatório" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) return json(500, { error: "Credenciais internas do Supabase ausentes" });

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return json(401, { error: "Sessão inválida" });

    const body = await req.json().catch(() => ({}));
    const incoming = Array.isArray(body?.rows) ? body.rows as IncomingRow[] : [];
    if (incoming.length === 0) return json(400, { error: "Nenhuma linha recebida" });

    const mapped = dedupeRows(incoming.map(mapRow).filter((row): row is TransferenciaRow => row != null));
    const invalidas = incoming.length - mapped.length;
    if (mapped.length === 0) {
      return json(400, {
        error: "Nenhuma linha válida (precisa estar CONCLUIDO, com código de solicitação e data de transferência)",
        recebidas: incoming.length,
        ignoradas: invalidas,
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      db: { schema: "euro_dash" },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Só grava solicitação nova. Registro já existente (mesmo com ajuste manual) fica intacto.
    const existing = await fetchExistingSolicitacoes(
      supabase,
      mapped.map((row) => row.cod_solicitacao),
    );
    const rows = mapped.filter((row) => !existing.has(row.cod_solicitacao));
    const jaExistentes = mapped.length - rows.length;

    let gravadas = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from("dados_transferencias").insert(batch);
      if (insertError) throw insertError;
      gravadas += batch.length;
    }

    return json(200, {
      ok: true,
      recebidas: incoming.length,
      gravadas,
      ignoradas: invalidas + jaExistentes,
      ja_existentes: jaExistentes,
      invalidas,
      meses_substituidos: [],
      total_linhas_enviadas: gravadas,
      user_id: userData.user.id,
    });
  } catch (error) {
    console.error("ingest-transferencias", error);
    return json(500, { error: errorMessage(error) });
  }
});
