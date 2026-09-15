-- Captação por cliente + assessor + mês, com as mesmas colunas da mv_resumo_assessor.
-- Cap "pura" ignora WEALTH/TRANSF; transferência vem de vw_transferencias_assessor.

CREATE OR REPLACE VIEW euro_dash.vw_captacao_detalhada AS
WITH tipo_pessoa_cliente AS (
  SELECT DISTINCT ON (dados_positivador.cliente)
    dados_positivador.cliente,
    dados_positivador.tipo_pessoa
  FROM euro_dash.dados_positivador
  ORDER BY dados_positivador.cliente, dados_positivador.data_posicao DESC
),
captacao_mensal AS (
  SELECT
    CASE
      WHEN dc.cod_assessor ~~ 'A%'::text THEN dc.cod_assessor
      ELSE 'A'::text || dc.cod_assessor
    END AS cod_assessor,
    dc.cod_cliente,
    date_trunc('month'::text, dc.data_captacao::timestamp with time zone)::date AS mes_ref,
    sum(CASE WHEN dc.aux = 'C'::text THEN dc.valor_captacao ELSE 0::numeric END) AS captacao_entradas,
    sum(CASE WHEN dc.aux = 'D'::text THEN dc.valor_captacao ELSE 0::numeric END) AS captacao_saidas,
    sum(CASE WHEN tp.tipo_pessoa = 'PESSOA FÍSICA'::text AND dc.aux = 'C'::text THEN dc.valor_captacao ELSE 0::numeric END) AS captacao_entradas_pf,
    sum(CASE WHEN tp.tipo_pessoa = 'PESSOA FÍSICA'::text AND dc.aux = 'D'::text THEN dc.valor_captacao ELSE 0::numeric END) AS captacao_saidas_pf,
    sum(CASE WHEN COALESCE(tp.tipo_pessoa, ''::text) <> 'PESSOA FÍSICA'::text AND dc.aux = 'C'::text THEN dc.valor_captacao ELSE 0::numeric END) AS captacao_entradas_pj,
    sum(CASE WHEN COALESCE(tp.tipo_pessoa, ''::text) <> 'PESSOA FÍSICA'::text AND dc.aux = 'D'::text THEN dc.valor_captacao ELSE 0::numeric END) AS captacao_saidas_pj
  FROM euro_dash.dados_captacoes dc
  LEFT JOIN tipo_pessoa_cliente tp ON tp.cliente = dc.cod_cliente
  WHERE dc.tipo_captacao <> ALL (ARRAY['WEALTH'::text, 'TRANSF'::text])
  GROUP BY 1, 2, 3
),
captacao_transferencia AS (
  SELECT
    CASE
      WHEN t.cod_assessor ~~ 'A%'::text THEN t.cod_assessor
      ELSE 'A'::text || t.cod_assessor
    END AS cod_assessor,
    t.cod_cliente,
    date_trunc('month'::text, t.data_transferencia::timestamp with time zone)::date AS mes_ref,
    sum(CASE WHEN t.valor > 0::numeric THEN t.valor ELSE 0::numeric END) AS captacao_entrada_transf,
    sum(CASE WHEN t.valor < 0::numeric THEN t.valor ELSE 0::numeric END) AS captacao_saida_transf,
    sum(CASE WHEN tp.tipo_pessoa = 'PESSOA FÍSICA'::text AND t.valor > 0::numeric THEN t.valor ELSE 0::numeric END) AS captacao_entrada_transf_pf,
    sum(CASE WHEN tp.tipo_pessoa = 'PESSOA FÍSICA'::text AND t.valor < 0::numeric THEN t.valor ELSE 0::numeric END) AS captacao_saida_transf_pf,
    sum(CASE WHEN COALESCE(tp.tipo_pessoa, ''::text) <> 'PESSOA FÍSICA'::text AND t.valor > 0::numeric THEN t.valor ELSE 0::numeric END) AS captacao_entrada_transf_pj,
    sum(CASE WHEN COALESCE(tp.tipo_pessoa, ''::text) <> 'PESSOA FÍSICA'::text AND t.valor < 0::numeric THEN t.valor ELSE 0::numeric END) AS captacao_saida_transf_pj
  FROM euro_dash.vw_transferencias_assessor t
  LEFT JOIN tipo_pessoa_cliente tp ON tp.cliente = t.cod_cliente
  GROUP BY 1, 2, 3
),
chaves AS (
  SELECT cod_assessor, cod_cliente, mes_ref FROM captacao_mensal
  UNION
  SELECT cod_assessor, cod_cliente, mes_ref FROM captacao_transferencia
)
SELECT
  to_char(c.mes_ref, 'YYYYMM'::text) AS ano_mes,
  c.mes_ref,
  c.cod_assessor,
  upper((split_part(col.nome_completo, ' '::text, 1) || ' '::text) ||
    CASE
      WHEN length(split_part(col.nome_completo, ' '::text, 2)) <= 3 AND split_part(col.nome_completo, ' '::text, 3) <> ''::text
        THEN split_part(col.nome_completo, ' '::text, 3)
      ELSE split_part(col.nome_completo, ' '::text, 2)
    END) AS nome_assessor,
  c.cod_cliente,
  tp.tipo_pessoa,
  (c.cod_assessor || '|'::text) || to_char(c.mes_ref, 'YYYYMM'::text) AS chave_data_assessor,
  ((c.cod_assessor || '|'::text) || to_char(c.mes_ref, 'YYYYMM'::text) || '|'::text) || c.cod_cliente AS chave_data_cliente,
  round(COALESCE(cm.captacao_entradas, 0::numeric), 2) AS captacao_entradas,
  round(COALESCE(cm.captacao_saidas, 0::numeric), 2) AS captacao_saidas,
  round(COALESCE(cm.captacao_entradas, 0::numeric) + COALESCE(cm.captacao_saidas, 0::numeric), 2) AS captacao_liquida,
  round(COALESCE(ctr.captacao_entrada_transf, 0::numeric), 2) AS captacao_entrada_transf,
  round(COALESCE(ctr.captacao_saida_transf, 0::numeric), 2) AS captacao_saida_transf,
  round(COALESCE(ctr.captacao_entrada_transf, 0::numeric) + COALESCE(ctr.captacao_saida_transf, 0::numeric), 2) AS captacao_transf_liquida,
  round(
    COALESCE(cm.captacao_entradas, 0::numeric) + COALESCE(cm.captacao_saidas, 0::numeric)
    + COALESCE(ctr.captacao_entrada_transf, 0::numeric) + COALESCE(ctr.captacao_saida_transf, 0::numeric),
    2
  ) AS captacao_liquida_total,
  round(
    COALESCE(cm.captacao_entradas_pf, 0::numeric) + COALESCE(cm.captacao_saidas_pf, 0::numeric)
    + COALESCE(ctr.captacao_entrada_transf_pf, 0::numeric) + COALESCE(ctr.captacao_saida_transf_pf, 0::numeric),
    2
  ) AS captacao_liquida_total_pf,
  round(
    COALESCE(cm.captacao_entradas_pj, 0::numeric) + COALESCE(cm.captacao_saidas_pj, 0::numeric)
    + COALESCE(ctr.captacao_entrada_transf_pj, 0::numeric) + COALESCE(ctr.captacao_saida_transf_pj, 0::numeric),
    2
  ) AS captacao_liquida_total_pj
FROM chaves c
LEFT JOIN captacao_mensal cm
  ON cm.cod_assessor = c.cod_assessor
 AND cm.cod_cliente = c.cod_cliente
 AND cm.mes_ref = c.mes_ref
LEFT JOIN captacao_transferencia ctr
  ON ctr.cod_assessor = c.cod_assessor
 AND ctr.cod_cliente = c.cod_cliente
 AND ctr.mes_ref = c.mes_ref
LEFT JOIN tipo_pessoa_cliente tp ON tp.cliente = c.cod_cliente
LEFT JOIN euro_dash.dados_colaboradores col ON col.cod_assessor = c.cod_assessor;

GRANT SELECT ON euro_dash.vw_captacao_detalhada TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.vw_captacao_detalhada AS
SELECT * FROM euro_dash.vw_captacao_detalhada;

GRANT SELECT ON public.vw_captacao_detalhada TO anon, authenticated, service_role;
