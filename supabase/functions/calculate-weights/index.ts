// Supabase Edge Function: calculate-weights
// Recebe uma lista de subatividades e retorna pesos calculados via OpenAI (gpt-4o-mini)
// IMPORTANTE: Configure o segredo OPENAI_API_KEY na instância do Supabase.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subactivities, project_id, openai_api_key } = await req.json();

    if (!Array.isArray(subactivities) || subactivities.length === 0) {
      return new Response(
        JSON.stringify({ error: "subactivities deve ser um array não vazio" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Obter chave do OpenRouter das variáveis de ambiente ou do frontend (desenvolvimento)
    const apiKey = Deno.env.get("OPENROUTER_API_KEY") || openai_api_key;
    if (!apiKey) {
      console.warn("OPENROUTER_API_KEY não configurada, usando fallback heurístico");
      // Fallback heurístico em caso de erro de API
      const weights = subactivities.map((s: any) => {
        const text = (s.title + " " + (s.description || "")).toLowerCase();
        let peso = 3;
        let justificativa = "Análise automática por tamanho";
        const length = text.length;
        if (length < 30) { peso = 1; justificativa = "Tarefa curta e simples"; }
        else if (length < 80) { peso = 2; justificativa = "Tarefa de baixa complexidade"; }
        else if (length < 140) { peso = 3; justificativa = "Tarefa de complexidade média"; }
        else if (length < 220) { peso = 5; justificativa = "Tarefa extensa e complexa"; }
        else { peso = 8; justificativa = "Tarefa muito extensa"; }
        if (/crítico|urgente|complexo|difícil|bloqueio/.test(text)) { peso = Math.max(peso, 5); justificativa = "Contém palavras de alta complexidade"; }
        if (/fácil|simples|rápido|trivial/.test(text)) { peso = Math.min(peso, 3); justificativa = "Contém palavras de baixa complexidade"; }
        return { id: s.id, peso, justificativa };
      });
      return new Response(JSON.stringify({ weights, project_id, usingAI: false }), { headers: corsHeaders, status: 200 });
    }

    const prompt = [
      "Você é um avaliador que atribui pesos de esforço para checklists de atividades.",
      "Para cada subatividade, analise o título e (se houver) a descrição.",
      "Retorne APENAS um JSON com um array de objetos no formato: {\"id\": \"<id>\", \"peso\": <numero>, \"justificativa\": \"<texto>\"}.",
      "Use somente um destes valores de peso: 1, 2, 3, 5, 8.",
      "Regra geral: fácil=1-2, médio=3, difícil=5, muito difícil/crítico=8.",
      "A justificativa deve ser uma frase curta (máximo 50 caracteres) explicando o motivo do peso.",
      "Não inclua comentários, textos extras ou chaves adicionais. Apenas o JSON.",
      "Subatividades:",
      JSON.stringify(subactivities),
    ].join("\n");

    const body = {
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "Você retorna somente JSON válido conforme solicitado." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    };

    const oaRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://projects-euro.com",
        "X-Title": "Projects Euro - Weight Calculator",
      },
      body: JSON.stringify(body),
    });

    if (!oaRes.ok) {
      const errText = await oaRes.text();
      console.error("Erro na API do OpenRouter:", errText);
      // Fallback heurístico em caso de erro de API
      const weights = subactivities.map((s: any) => {
        const text = (s.title + " " + (s.description || "")).toLowerCase();
        let peso = 3;
        let justificativa = "Análise automática por tamanho";
        const length = text.length;
        if (length < 30) { peso = 1; justificativa = "Tarefa curta e simples"; }
        else if (length < 80) { peso = 2; justificativa = "Tarefa de baixa complexidade"; }
        else if (length < 140) { peso = 3; justificativa = "Tarefa de complexidade média"; }
        else if (length < 220) { peso = 5; justificativa = "Tarefa extensa e complexa"; }
        else { peso = 8; justificativa = "Tarefa muito extensa"; }
        if (/crítico|urgente|complexo|difícil|bloqueio/.test(text)) { peso = Math.max(peso, 5); justificativa = "Contém palavras de alta complexidade"; }
        if (/fácil|simples|rápido|trivial/.test(text)) { peso = Math.min(peso, 3); justificativa = "Contém palavras de baixa complexidade"; }
        return { id: s.id, peso, justificativa };
      });
      return new Response(JSON.stringify({ weights, project_id, usingAI: false }), { headers: corsHeaders, status: 200 });
    }

    const oaJson = await oaRes.json();
    const content = oaJson?.choices?.[0]?.message?.content ?? "";

    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\[.*\]/s);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {}
      }
    }

    let weights: Array<{ id: string; peso: number; justificativa: string }> = [];

    if (Array.isArray(parsed)) {
      // Validar e normalizar pesos para os valores permitidos
      const allowed = new Set([1, 2, 3, 5, 8]);
      weights = parsed
        .filter((x: any) => x && typeof x.id === "string")
        .map((x: any) => {
          let peso = Number(x.peso);
          let justificativa = x.justificativa || "Avaliado pela IA";
          if (!allowed.has(peso)) {
            // Ajustar para o valor mais próximo permitido
            const candidates = [1, 2, 3, 5, 8];
            const nearest = candidates.reduce((prev, curr) => (
              Math.abs(curr - peso) < Math.abs(prev - peso) ? curr : prev
            ));
            peso = nearest;
            justificativa += " (peso ajustado)";
          }
          return { id: x.id, peso, justificativa };
        });
    } else {
      // Fallback heurístico se parsing falhar
      weights = subactivities.map((s: any) => {
        const text = (s.title + " " + (s.description || "")).toLowerCase();
        let peso = 3;
        let justificativa = "Análise automática por tamanho";
        const length = text.length;
        if (length < 30) { peso = 1; justificativa = "Tarefa curta e simples"; }
        else if (length < 80) { peso = 2; justificativa = "Tarefa de baixa complexidade"; }
        else if (length < 140) { peso = 3; justificativa = "Tarefa de complexidade média"; }
        else if (length < 220) { peso = 5; justificativa = "Tarefa extensa e complexa"; }
        else { peso = 8; justificativa = "Tarefa muito extensa"; }
        if (/crítico|urgente|complexo|difícil|bloqueio/.test(text)) { peso = Math.max(peso, 5); justificativa = "Contém palavras de alta complexidade"; }
        if (/fácil|simples|rápido|trivial/.test(text)) { peso = Math.min(peso, 3); justificativa = "Contém palavras de baixa complexidade"; }
        return { id: s.id, peso, justificativa };
      });
    }

    return new Response(JSON.stringify({ weights, project_id, usingAI: true }), {
      headers: corsHeaders,
      status: 200,
    });
  } catch (e) {
    console.error("Unexpected error in calculate-weights:", e);
    return new Response(
      JSON.stringify({ error: "Erro inesperado ao calcular pesos" }),
      { status: 500, headers: corsHeaders }
    );
  }
});