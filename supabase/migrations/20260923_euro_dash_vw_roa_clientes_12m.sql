-- View consultável de ROA Invest por cliente (12m).
-- Fonte: demonstrativo (receita invest) + positivador (base média).
-- Seguro/consórcio fora (não entram no demonstrativo).

CREATE OR REPLACE VIEW euro_dash.vw_roa_clientes_12m AS
WITH params AS (
  SELECT
    (date_trunc('month', CURRENT_DATE) - INTERVAL '11 months')::date AS janela_inicio,
    (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date AS janela_fim
), receita_mensal AS (
  SELECT
    regexp_replace(d.cod_cliente, '\D', '', 'g') AS cod_cliente,
    date_trunc('month', d.data::timestamp)::date AS mes_ref,
    sum(COALESCE(euro_dash.parse_br_numeric(d.receita_rs), 0)) AS receita_bruta,
    sum(COALESCE(euro_dash.parse_br_numeric(d.receita_liquida_rs), 0)) AS receita_liquida
  FROM euro_dash.dados_demonstrativo_full d
  CROSS JOIN params p
  WHERE d.data >= p.janela_inicio
    AND d.data <= p.janela_fim
    AND d.cod_cliente IS NOT NULL
    AND regexp_replace(d.cod_cliente, '\D', '', 'g') <> ''
  GROUP BY 1, 2
), receita AS (
  SELECT
    r.cod_cliente,
    sum(r.receita_bruta) AS receita_invest_12m,
    sum(r.receita_liquida) AS receita_liquida_12m,
    count(*) FILTER (WHERE r.receita_bruta <> 0 OR r.receita_liquida <> 0)::integer AS meses_com_receita,
    jsonb_object_agg(
      to_char(r.mes_ref, 'MM/YYYY'),
      round(r.receita_bruta, 2)
      ORDER BY r.mes_ref
    ) AS historico_receita
  FROM receita_mensal r
  GROUP BY r.cod_cliente
), base_mensal AS (
  SELECT
    regexp_replace(dp.cliente, '\D', '', 'g') AS cod_cliente,
    date_trunc('month', dp.data_posicao)::date AS mes_ref,
    avg(COALESCE(euro_dash.parse_br_numeric(dp.net_em_m), 0)) AS net_em_m
  FROM euro_dash.dados_positivador dp
  CROSS JOIN params p
  WHERE dp.data_posicao >= p.janela_inicio
    AND dp.data_posicao <= p.janela_fim
    AND dp.cliente IS NOT NULL
    AND regexp_replace(dp.cliente, '\D', '', 'g') <> ''
  GROUP BY 1, 2
), base AS (
  SELECT
    b.cod_cliente,
    avg(b.net_em_m) AS base_media_12m,
    count(*)::integer AS meses_com_base,
    jsonb_object_agg(
      to_char(b.mes_ref, 'MM/YYYY'),
      round(b.net_em_m, 2)
      ORDER BY b.mes_ref
    ) AS historico_net
  FROM base_mensal b
  GROUP BY b.cod_cliente
), atual AS (
  SELECT DISTINCT ON (regexp_replace(dp.cliente, '\D', '', 'g'))
    regexp_replace(dp.cliente, '\D', '', 'g') AS cod_cliente,
    regexp_replace(upper(btrim(dp.assessor)), '^A', '', 'i') AS assessor,
    COALESCE(euro_dash.parse_br_numeric(dp.net_em_m), 0) AS net_atual,
    dp.data_posicao
  FROM euro_dash.dados_positivador dp
  WHERE dp.cliente IS NOT NULL
    AND regexp_replace(dp.cliente, '\D', '', 'g') <> ''
  ORDER BY regexp_replace(dp.cliente, '\D', '', 'g'), dp.data_posicao DESC NULLS LAST
), nomes AS (
  SELECT DISTINCT ON (regexp_replace(c.cod_cliente, '\D', '', 'g'))
    regexp_replace(c.cod_cliente, '\D', '', 'g') AS cod_cliente,
    c.nome_cliente
  FROM euro_dash.dados_clientes c
  WHERE c.cod_cliente IS NOT NULL
  ORDER BY regexp_replace(c.cod_cliente, '\D', '', 'g'), c.nome_cliente NULLS LAST
), nomes_assessor AS (
  SELECT DISTINCT ON (regexp_replace(upper(btrim(m.cod_assessor)), '^A', '', 'i'))
    regexp_replace(upper(btrim(m.cod_assessor)), '^A', '', 'i') AS assessor,
    m.nome_assessor
  FROM euro_dash.mv_resumo_assessor m
  WHERE m.cod_assessor IS NOT NULL
  ORDER BY
    regexp_replace(upper(btrim(m.cod_assessor)), '^A', '', 'i'),
    m.data_posicao DESC NULLS LAST
)
SELECT
  a.cod_cliente,
  n.nome_cliente,
  a.assessor,
  na.nome_assessor,
  p.janela_inicio,
  p.janela_fim,
  COALESCE(r.meses_com_receita, 0) AS meses_com_receita,
  COALESCE(b.meses_com_base, 0) AS meses_com_base,
  round(COALESCE(r.receita_invest_12m, 0), 2) AS receita_invest_12m,
  round(COALESCE(r.receita_liquida_12m, 0), 2) AS receita_liquida_12m,
  round(COALESCE(b.base_media_12m, 0), 2) AS base_media_12m,
  round(COALESCE(a.net_atual, 0), 2) AS net_atual,
  CASE
    WHEN COALESCE(b.base_media_12m, 0) > 0
      THEN round((COALESCE(r.receita_invest_12m, 0) / b.base_media_12m) * 12, 6)
    ELSE NULL
  END AS roa_invest_12m,
  CASE
    WHEN COALESCE(b.base_media_12m, 0) > 0
      THEN round((COALESCE(r.receita_invest_12m, 0) / b.base_media_12m) * 12 * 100, 4)
    ELSE NULL
  END AS roa_invest_pct,
  COALESCE(r.historico_receita, '{}'::jsonb) AS historico_receita,
  COALESCE(b.historico_net, '{}'::jsonb) AS historico_net
FROM atual a
CROSS JOIN params p
LEFT JOIN receita r ON r.cod_cliente = a.cod_cliente
LEFT JOIN base b ON b.cod_cliente = a.cod_cliente
LEFT JOIN nomes n ON n.cod_cliente = a.cod_cliente
LEFT JOIN nomes_assessor na ON na.assessor = a.assessor
WHERE COALESCE(r.receita_invest_12m, 0) <> 0
   OR COALESCE(b.base_media_12m, 0) <> 0;

COMMENT ON VIEW euro_dash.vw_roa_clientes_12m IS
  'ROA Invest por cliente nos últimos 12 meses: (receita_invest_12m / base_media_12m) * 12. Sem cross-sell.';

GRANT SELECT ON euro_dash.vw_roa_clientes_12m TO anon, authenticated, service_role;

-- RPC passa a filtrar a view (mesma lógica, com filtro opcional de assessor).
CREATE OR REPLACE FUNCTION euro_dash.rpc_get_roa_clientes_12m(
  p_assessores text[] DEFAULT NULL
)
RETURNS TABLE(
  cod_cliente text,
  nome_cliente text,
  assessor text,
  nome_assessor text,
  janela_inicio date,
  janela_fim date,
  meses_com_receita integer,
  meses_com_base integer,
  receita_invest_12m numeric,
  receita_liquida_12m numeric,
  base_media_12m numeric,
  net_atual numeric,
  roa_invest_12m numeric,
  roa_invest_pct numeric,
  historico_receita jsonb,
  historico_net jsonb
)
LANGUAGE sql
STABLE
AS $$
  WITH assessor_filter AS (
    SELECT DISTINCT
      regexp_replace(upper(btrim(a)), '^A', '', 'i') AS assessor
    FROM unnest(COALESCE(p_assessores, ARRAY[]::text[])) AS a
    WHERE btrim(a) <> ''
  )
  SELECT
    v.cod_cliente,
    v.nome_cliente,
    v.assessor,
    v.nome_assessor,
    v.janela_inicio,
    v.janela_fim,
    v.meses_com_receita,
    v.meses_com_base,
    v.receita_invest_12m,
    v.receita_liquida_12m,
    v.base_media_12m,
    v.net_atual,
    v.roa_invest_12m,
    v.roa_invest_pct,
    v.historico_receita,
    v.historico_net
  FROM euro_dash.vw_roa_clientes_12m v
  WHERE
    NOT EXISTS (SELECT 1 FROM assessor_filter)
    OR v.assessor IN (SELECT af.assessor FROM assessor_filter af)
  ORDER BY v.roa_invest_pct NULLS LAST, v.cod_cliente;
$$;

GRANT EXECUTE ON FUNCTION euro_dash.rpc_get_roa_clientes_12m(text[])
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
