-- Carteira: snapshot mais recente até p_data_max (em vez de materializar o histórico).
-- Pareto: SQL estável + nome do cliente na própria RPC (sem ir na vw_resumo_clientes_posicao).

CREATE INDEX IF NOT EXISTS dados_clientes_cod_cliente_idx
  ON euro_dash.dados_clientes (cod_cliente);

CREATE INDEX IF NOT EXISTS dados_demonstrativo_full_data_assessor_idx
  ON euro_dash.dados_demonstrativo_full (data, cod_assessor_direto);

DROP FUNCTION IF EXISTS euro_dash.rpc_get_diversificador_full(text[]);

CREATE OR REPLACE FUNCTION euro_dash.rpc_get_diversificador_full(
  p_assessores text[] DEFAULT NULL,
  p_data_max date DEFAULT NULL
)
RETURNS TABLE(
  assessor text,
  cliente text,
  produto text,
  subproduto text,
  fator_risco text,
  ativo text,
  data_posicao date,
  data_vencimento date,
  cnpj text,
  net text,
  distribuicao_carteira text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    v.assessor,
    v.cliente,
    v.produto,
    v.subproduto,
    v.fator_risco,
    v.ativo,
    v.data_posicao,
    v.data_vencimento,
    v.cnpj,
    v.net,
    v.distribuicao_carteira
  FROM euro_dash.vw_diversificador_full v
  WHERE (p_assessores IS NULL
         OR v.assessor = ANY (p_assessores)
         OR ('A' || v.assessor) = ANY (p_assessores))
    AND (p_data_max IS NULL OR v.data_posicao <= p_data_max)
    AND v.data_posicao = (
      SELECT MAX(v2.data_posicao)
      FROM euro_dash.vw_diversificador_full v2
      WHERE (p_assessores IS NULL
             OR v2.assessor = ANY (p_assessores)
             OR ('A' || v2.assessor) = ANY (p_assessores))
        AND (p_data_max IS NULL OR v2.data_posicao <= p_data_max)
    )
$$;

GRANT EXECUTE ON FUNCTION euro_dash.rpc_get_diversificador_full(text[], date)
  TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS euro_dash.rpc_get_pareto_clientes_12m(text[]);

CREATE OR REPLACE FUNCTION euro_dash.rpc_get_pareto_clientes_12m(
  p_assessores text[] DEFAULT NULL
)
RETURNS TABLE(
  cod_cliente text,
  nome_cliente text,
  receita_bruta_total numeric,
  ranking_bruto bigint,
  perc_receita_bruta numeric,
  perc_acumulado_bruto numeric,
  receita_liquida_total numeric,
  ranking_liquido bigint,
  perc_receita_liquida numeric,
  perc_acumulado_liquido numeric,
  classe_pareto_bruto text,
  classe_pareto_liquido text,
  historico_bruto jsonb,
  historico_liquido jsonb
)
LANGUAGE sql
STABLE
AS $$
  WITH receita_mensal AS (
    SELECT
      d.cod_cliente,
      to_char(d.data::timestamp with time zone, 'MM/YYYY'::text) AS mes_ano,
      sum(COALESCE(NULLIF(replace(replace(d.receita_rs, '.'::text, ''::text), ','::text, '.'::text), ''::text)::numeric, 0::numeric)) AS receita_bruta,
      sum(COALESCE(NULLIF(replace(replace(d.receita_liquida_rs, '.'::text, ''::text), ','::text, '.'::text), ''::text)::numeric, 0::numeric)) AS receita_liquida
    FROM euro_dash.dados_demonstrativo_full d
    WHERE d.data >= (CURRENT_DATE - '1 year'::interval)
      AND d.cod_cliente IS NOT NULL
      AND (
        p_assessores IS NULL
        OR ('A' || d.cod_assessor_direto) = ANY (p_assessores)
        OR d.cod_assessor_direto = ANY (p_assessores)
      )
    GROUP BY d.cod_cliente, (to_char(d.data::timestamp with time zone, 'MM/YYYY'::text))
  ), historico AS (
    SELECT
      r.cod_cliente,
      jsonb_object_agg(r.mes_ano, r.receita_bruta ORDER BY (to_date(r.mes_ano, 'MM/YYYY'::text))) AS historico_bruto,
      jsonb_object_agg(r.mes_ano, r.receita_liquida ORDER BY (to_date(r.mes_ano, 'MM/YYYY'::text))) AS historico_liquido
    FROM receita_mensal r
    GROUP BY r.cod_cliente
  ), base AS (
    SELECT
      r.cod_cliente,
      sum(r.receita_bruta) AS receita_bruta_total,
      sum(r.receita_liquida) AS receita_liquida_total
    FROM receita_mensal r
    GROUP BY r.cod_cliente
  ), totais AS (
    SELECT
      sum(b.receita_bruta_total) AS total_bruto,
      sum(b.receita_liquida_total) AS total_liquido
    FROM base b
  ), nomes AS (
    SELECT DISTINCT ON (c.cod_cliente)
      c.cod_cliente,
      c.nome_cliente
    FROM euro_dash.dados_clientes c
    ORDER BY c.cod_cliente, c.nome_cliente NULLS LAST
  )
  SELECT
    b.cod_cliente,
    n.nome_cliente,
    b.receita_bruta_total,
    row_number() OVER (ORDER BY b.receita_bruta_total DESC) AS ranking_bruto,
    round(b.receita_bruta_total / NULLIF(t.total_bruto, 0::numeric) * 100::numeric, 2) AS perc_receita_bruta,
    round(sum(b.receita_bruta_total) OVER (ORDER BY b.receita_bruta_total DESC) / NULLIF(t.total_bruto, 0::numeric) * 100::numeric, 2) AS perc_acumulado_bruto,
    b.receita_liquida_total,
    row_number() OVER (ORDER BY b.receita_liquida_total DESC) AS ranking_liquido,
    round(b.receita_liquida_total / NULLIF(t.total_liquido, 0::numeric) * 100::numeric, 2) AS perc_receita_liquida,
    round(sum(b.receita_liquida_total) OVER (ORDER BY b.receita_liquida_total DESC) / NULLIF(t.total_liquido, 0::numeric) * 100::numeric, 2) AS perc_acumulado_liquido,
    CASE
      WHEN (sum(b.receita_bruta_total) OVER (ORDER BY b.receita_bruta_total DESC) / NULLIF(t.total_bruto, 0::numeric) * 100::numeric) <= 80::numeric THEN 'A'::text
      WHEN (sum(b.receita_bruta_total) OVER (ORDER BY b.receita_bruta_total DESC) / NULLIF(t.total_bruto, 0::numeric) * 100::numeric) <= 95::numeric THEN 'B'::text
      ELSE 'C'::text
    END AS classe_pareto_bruto,
    CASE
      WHEN (sum(b.receita_liquida_total) OVER (ORDER BY b.receita_liquida_total DESC) / NULLIF(t.total_liquido, 0::numeric) * 100::numeric) <= 80::numeric THEN 'A'::text
      WHEN (sum(b.receita_liquida_total) OVER (ORDER BY b.receita_liquida_total DESC) / NULLIF(t.total_liquido, 0::numeric) * 100::numeric) <= 95::numeric THEN 'B'::text
      ELSE 'C'::text
    END AS classe_pareto_liquido,
    h.historico_bruto,
    h.historico_liquido
  FROM base b
  CROSS JOIN totais t
  LEFT JOIN historico h ON h.cod_cliente = b.cod_cliente
  LEFT JOIN nomes n ON n.cod_cliente = b.cod_cliente
$$;

GRANT EXECUTE ON FUNCTION euro_dash.rpc_get_pareto_clientes_12m(text[])
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
