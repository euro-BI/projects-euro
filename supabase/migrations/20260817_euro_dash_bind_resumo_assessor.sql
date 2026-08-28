-- Rebind euro_dash views/MV to euro_dash tables. public objects stay untouched.

CREATE OR REPLACE VIEW euro_dash.vw_dados_consorcio_comissoes AS
WITH base AS (
  SELECT
    dc.id,
    dc.administradora,
    dc.cod_assessor,
    dc.data_venda,
    dc.produto,
    dc.observacao,
    dc.codigo_cliente,
    dc.cliente,
    dc.cpf_cnpj,
    dc.contrato,
    dc.grupo,
    dc.cota,
    dc.valor_carta,
    dc.data_cancelamento,
    adm.comissao_percent,
    CASE
      WHEN dc.administradora = 'ADEMICON'::text THEN 15
      WHEN dc.produto ~~* '%50%'::text THEN 12
      ELSE 6
    END AS num_parcelas
  FROM euro_dash.dados_consorcio dc
  LEFT JOIN euro_dash.dados_consorcios_adm adm ON adm.administradora = dc.administradora
)
SELECT
  b.id,
  b.administradora,
  b.cod_assessor,
  b.data_venda,
  b.produto,
  b.observacao,
  b.codigo_cliente,
  b.cliente,
  b.cpf_cnpj,
  b.contrato,
  b.grupo,
  b.cota,
  b.valor_carta,
  b.comissao_percent,
  b.num_parcelas,
  gs.mes_parcela,
  CASE
    WHEN b.administradora = 'ADEMICON'::text THEN (b.data_venda + (((gs.mes_parcela - 1) || ' months'::text)::interval))::date
    ELSE (b.data_venda + ((gs.mes_parcela || ' months'::text)::interval))::date
  END AS data_vencimento,
  CASE
    WHEN b.administradora = 'ADEMICON'::text THEN
      CASE
        WHEN gs.mes_parcela >= 1 AND gs.mes_parcela <= 10 THEN b.valor_carta * 0.001288
        WHEN gs.mes_parcela >= 11 AND gs.mes_parcela <= 13 THEN b.valor_carta * 0.002374
        WHEN gs.mes_parcela = 14 THEN 0::numeric
        WHEN gs.mes_parcela = 15 THEN b.valor_carta * 0.0030
        ELSE 0::numeric
      END
    ELSE b.valor_carta * (b.comissao_percent / 100::numeric) / b.num_parcelas::numeric
  END AS valor_comissao_mensal
FROM base b
CROSS JOIN LATERAL generate_series(1, b.num_parcelas) gs(mes_parcela)
WHERE b.data_cancelamento IS NULL OR date_trunc('month'::text,
  CASE
    WHEN b.administradora = 'ADEMICON'::text THEN b.data_venda + (((gs.mes_parcela - 1) || ' months'::text)::interval)
    ELSE b.data_venda + ((gs.mes_parcela || ' months'::text)::interval)
  END) < date_trunc('month'::text, b.data_cancelamento::timestamp with time zone);

CREATE OR REPLACE VIEW euro_dash.vw_transferencias_assessor AS
WITH transf AS (
  SELECT
    dt.id,
    dt.cod_cliente,
    dt.cod_assessor_origem,
    dt.cod_assessor_destino,
    dt.data_solicitacao,
    dt.data_transferencia,
    dt.status,
    dt.created_at,
    dt.updated_at,
    dt.cod_solicitacao,
    CASE
      WHEN dt.cod_assessor_origem = '-'::text THEN '-'::text
      WHEN dt.cod_assessor_origem ~~ 'A%'::text THEN dt.cod_assessor_origem
      ELSE 'A'::text || dt.cod_assessor_origem
    END AS cod_assessor_origem_pad,
    CASE
      WHEN dt.cod_assessor_destino = '-'::text THEN '-'::text
      WHEN dt.cod_assessor_destino ~~ 'A%'::text THEN dt.cod_assessor_destino
      ELSE 'A'::text || dt.cod_assessor_destino
    END AS cod_assessor_destino_pad
  FROM euro_dash.dados_transferencias dt
)
SELECT
  CASE
    WHEN t.cod_assessor_destino_pad <> '-'::text AND t.cod_assessor_origem_pad <> '-'::text THEN t.cod_assessor_destino_pad
    WHEN t.cod_assessor_destino_pad = '-'::text THEN t.cod_assessor_origem_pad
    ELSE t.cod_assessor_destino_pad
  END AS cod_assessor,
  t.cod_cliente,
  t.cod_solicitacao,
  date_trunc('month'::text, t.data_transferencia::timestamp with time zone)::date AS data_transferencia,
  CASE
    WHEN t.cod_assessor_destino_pad <> '-'::text AND t.cod_assessor_origem_pad <> '-'::text THEN 'Interna'::text
    WHEN t.cod_assessor_destino_pad = '-'::text THEN 'Saída'::text
    ELSE 'Entrada'::text
  END AS tipo,
  round(
    CASE
      WHEN t.cod_assessor_destino_pad = '-'::text THEN LEAST(0::numeric, '-1'::integer::numeric * COALESCE((
        SELECT replace(dp2.net_em_m, ','::text, '.'::text)::numeric
        FROM euro_dash.dados_positivador dp2
        WHERE dp2.cliente = t.cod_cliente
        ORDER BY dp2.data_posicao DESC
        LIMIT 1
      ), 0::numeric))
      WHEN t.cod_assessor_origem_pad = '-'::text THEN GREATEST(0::numeric, COALESCE(replace(dp.net_em_m, ','::text, '.'::text)::numeric, 0::numeric) - COALESCE(cap.captacao_entradas, 0::numeric))
      ELSE COALESCE(replace(dp.net_em_m, ','::text, '.'::text)::numeric, 0::numeric)
    END, 2) AS valor
FROM transf t
LEFT JOIN euro_dash.dados_positivador dp
  ON dp.cliente = t.cod_cliente
 AND dp.data_posicao = date_trunc('month'::text, t.data_transferencia::timestamp with time zone)::date
LEFT JOIN (
  SELECT
    dc.cod_cliente,
    date_trunc('month'::text, dc.data_captacao::timestamp with time zone)::date AS mes_ref,
    sum(dc.valor_captacao) AS captacao_entradas
  FROM euro_dash.dados_captacoes dc
  WHERE dc.tipo_captacao <> 'TRANSF'::text
  GROUP BY dc.cod_cliente, (date_trunc('month'::text, dc.data_captacao::timestamp with time zone))
) cap ON cap.cod_cliente = t.cod_cliente
   AND cap.mes_ref = date_trunc('month'::text, t.data_transferencia::timestamp with time zone)::date
WHERE NOT (t.cod_assessor_destino_pad <> '-'::text AND t.cod_assessor_origem_pad <> '-'::text);

DO $$
DECLARE
  def text;
  idx_defs text[];
  idx text;
BEGIN
  SELECT pg_get_viewdef('euro_dash.mv_resumo_assessor'::regclass, true) INTO def;
  def := replace(def, 'public.', 'euro_dash.');

  SELECT coalesce(array_agg(indexdef), '{}')
    INTO idx_defs
  FROM pg_indexes
  WHERE schemaname = 'euro_dash'
    AND tablename = 'mv_resumo_assessor';

  DROP MATERIALIZED VIEW euro_dash.mv_resumo_assessor;

  PERFORM set_config('search_path', 'euro_dash, pg_temp', true);
  EXECUTE 'CREATE MATERIALIZED VIEW euro_dash.mv_resumo_assessor AS ' || def;
  PERFORM set_config('search_path', 'euro_dash, public, pg_catalog', true);

  FOREACH idx IN ARRAY idx_defs LOOP
    EXECUTE idx;
  END LOOP;

  EXECUTE 'GRANT ALL ON TABLE euro_dash.mv_resumo_assessor TO anon, authenticated, service_role';
END $$;
