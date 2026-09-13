import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const API_BASE = "https://turing-git-dev-eurostock-investimentos.vercel.app/api/bi-atividades";
const SYNC_FROM = "2026-08-01";
const MANUAL_ID_CEILING = 999000;
const RESULTADOS_SYNC = ["Realizada", "Agendada"] as const;

type TuringAtividade = {
  id: string;
  data_atividade: string | null;
  resultado: string | null;
  lead_origem: string | null;
  lead_origem_sdr?: boolean | null;
  lead_originado_por?: string | null;
  assessor_codigo: string | null;
  assessor_nome: string | null;
  assessor_email: string | null;
  autor_nome: string | null;
  autor_email: string | null;
};

type TuringResponse = {
  ok?: boolean;
  tem_mais?: boolean;
  pagina?: number;
  atividades?: TuringAtividade[];
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function todaySaoPaulo() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Horizonte para puxar R1 ainda no futuro (Agendada). */
function syncHorizonAte() {
  const today = todaySaoPaulo();
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 60);
  return d.toISOString().slice(0, 10);
}

function toDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function normalizeAssessor(value: string | null | undefined) {
  const code = String(value ?? "").trim().toUpperCase();
  return code || null;
}

function normalizeName(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function buildAssessorLookup(
  colaboradores: Array<{ cod_assessor: string | null; nome_completo: string | null; email: string | null }>,
) {
  const byName = new Map<string, string>();
  const byEmail = new Map<string, string>();

  for (const colaborador of colaboradores) {
    const code = normalizeAssessor(colaborador.cod_assessor);
    if (!code) continue;
    const name = normalizeName(colaborador.nome_completo);
    if (name && !byName.has(name)) byName.set(name, code);
    const email = String(colaborador.email ?? "").trim().toLowerCase();
    if (email && !byEmail.has(email)) byEmail.set(email, code);
  }

  return { byName, byEmail };
}

function resolveAssessor(
  atividade: TuringAtividade,
  lookup: ReturnType<typeof buildAssessorLookup>,
) {
  const fromCode = normalizeAssessor(atividade.assessor_codigo);
  if (fromCode) return fromCode;

  const email = String(atividade.assessor_email ?? atividade.autor_email ?? "").trim().toLowerCase();
  if (email && lookup.byEmail.has(email)) return lookup.byEmail.get(email) ?? null;

  const name = normalizeName(atividade.assessor_nome ?? atividade.autor_nome);
  if (name && lookup.byName.has(name)) return lookup.byName.get(name) ?? null;

  return null;
}

function readDate(value: unknown, fallback: string) {
  const date = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : fallback;
}

function isOrigemSdr(atividade: TuringAtividade) {
  if (atividade.lead_origem_sdr === true) return true;
  if (String(atividade.lead_originado_por ?? "").toUpperCase() === "SDR") return true;
  return String(atividade.lead_origem ?? "").toUpperCase().includes("SDR");
}

function normalizeResultado(value: string | null | undefined) {
  return String(value ?? "").trim();
}

async function fetchAtividades(params: {
  de: string;
  ate: string;
  tipo: string;
  resultado: string;
  apiKey: string;
  bypass: string;
}) {
  const rows: TuringAtividade[] = [];
  let pagina = 0;
  let temMais = true;

  while (temMais) {
    const url = new URL(API_BASE);
    url.searchParams.set("de", params.de);
    url.searchParams.set("ate", params.ate);
    url.searchParams.set("tipo", params.tipo);
    url.searchParams.set("resultado", params.resultado);
    url.searchParams.set("key", params.apiKey);
    url.searchParams.set("pagina", String(pagina));

    const response = await fetch(url.toString(), {
      headers: { "x-vercel-protection-bypass": params.bypass },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API Turing ${response.status}: ${text.slice(0, 300)}`);
    }

    const payload = (await response.json()) as TuringResponse;
    const pageRows = Array.isArray(payload.atividades) ? payload.atividades : [];
    rows.push(...pageRows);
    temMais = Boolean(payload.tem_mais);
    pagina += 1;
    if (pagina > 50) break;
  }

  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Use POST" });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const de = readDate(body.de, SYNC_FROM);
    const ate = readDate(body.ate, syncHorizonAte());
    const tipo = String(body.tipo ?? "Reunião R1");

    const apiKey = Deno.env.get("TURING_BI_API_KEY") || String(body.api_key ?? "");
    const bypass = Deno.env.get("TURING_VERCEL_BYPASS") || String(body.bypass ?? "");
    if (!apiKey || !bypass) {
      return json(500, { error: "Secrets TURING_BI_API_KEY / TURING_VERCEL_BYPASS não configurados" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Credenciais internas do Supabase ausentes" });
    }

    const porResultado = await Promise.all(
      RESULTADOS_SYNC.map(async (resultado) => ({
        resultado,
        rows: await fetchAtividades({ de, ate, tipo, resultado, apiKey, bypass }),
      })),
    );

    const seen = new Set<string>();
    const atividades: TuringAtividade[] = [];
    for (const lote of porResultado) {
      for (const atividade of lote.rows) {
        const key = atividade.id || `${atividade.data_atividade}|${atividade.assessor_codigo}|${atividade.resultado}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const resultado = normalizeResultado(atividade.resultado);
        if (resultado !== "Realizada" && resultado !== "Agendada") continue;
        atividades.push(atividade);
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      db: { schema: "euro_dash" },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: deleteError } = await supabase
      .from("pipe_manual")
      .delete()
      .gte("data_vencimento", de);

    if (deleteError) throw deleteError;

    const { data: colaboradores, error: colabError } = await supabase
      .from("dados_colaboradores")
      .select("cod_assessor, nome_completo, email");
    if (colabError) throw colabError;
    const lookup = buildAssessorLookup(colaboradores ?? []);

    const { data: maxRow, error: maxError } = await supabase
      .from("pipe_manual")
      .select("id_atividade")
      .lt("id_atividade", MANUAL_ID_CEILING)
      .order("id_atividade", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) throw maxError;

    let nextId = Number(maxRow?.id_atividade ?? 0) + 1;
    if (!Number.isFinite(nextId) || nextId < 1) nextId = 1;

    const createdAt = new Date().toISOString();
    let nSdr = 0;
    let nRealizada = 0;
    let nAgendada = 0;

    const rows = atividades.map((atividade) => {
      const data = toDateOnly(atividade.data_atividade);
      const resultado = normalizeResultado(atividade.resultado);
      const sdr = isOrigemSdr(atividade);
      if (sdr) nSdr += 1;
      if (resultado === "Realizada") nRealizada += 1;
      else nAgendada += 1;

      const row = {
        id_atividade: nextId,
        deal_id: "0",
        data_vencimento: data,
        data_adicionado: data,
        concluido: resultado === "Realizada" ? "TRUE" : "FALSE",
        canal: sdr ? "SDR" : "INDICAÇÃO",
        assessor: resolveAssessor(atividade, lookup),
        created_at: createdAt,
      };
      nextId += 1;
      return row;
    }).filter((row) => row.data_vencimento);

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("pipe_manual").insert(rows);
      if (insertError) throw insertError;
    }

    const buscadas = porResultado.reduce((acc, lote) => acc + lote.rows.length, 0);

    return json(200, {
      ok: true,
      de,
      ate,
      buscadas,
      gravadas: rows.length,
      sdr: nSdr,
      realizadas: nRealizada,
      agendadas: nAgendada,
      id_inicial: rows[0]?.id_atividade ?? null,
      id_final: rows.at(-1)?.id_atividade ?? null,
      created_at: createdAt,
    });
  } catch (error) {
    console.error("sync-pipe-manual", error);
    return json(500, { error: error instanceof Error ? error.message : "Erro inesperado" });
  }
});
