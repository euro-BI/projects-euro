-- A view de transferência buscava o net no dia 1 do mês.
-- O positivador novo grava a data real da posição (ex.: 2026-09-10), então o join
-- falhava e a entrada saía zerada / só com o ajuste da captação.
-- Passa a usar o net mais recente do mesmo mês.

CREATE OR REPLACE VIEW public.vw_transferencias_assessor AS
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
  FROM public.dados_transferencias dt
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
        FROM public.dados_positivador dp2
        WHERE dp2.cliente = t.cod_cliente
        ORDER BY dp2.data_posicao DESC
        LIMIT 1
      ), 0::numeric))
      WHEN t.cod_assessor_origem_pad = '-'::text THEN GREATEST(
        0::numeric,
        COALESCE(replace(dp.net_em_m, ','::text, '.'::text)::numeric, 0::numeric)
          - COALESCE(GREATEST(cap.captacao_entradas, 0::numeric), 0::numeric)
      )
      ELSE COALESCE(replace(dp.net_em_m, ','::text, '.'::text)::numeric, 0::numeric)
    END, 2) AS valor
FROM transf t
LEFT JOIN LATERAL (
  SELECT dp_mes.net_em_m
  FROM public.dados_positivador dp_mes
  WHERE dp_mes.cliente = t.cod_cliente
    AND date_trunc('month'::text, dp_mes.data_posicao::timestamp with time zone)
      = date_trunc('month'::text, t.data_transferencia::timestamp with time zone)
  ORDER BY dp_mes.data_posicao DESC, dp_mes.id DESC
  LIMIT 1
) dp ON true
LEFT JOIN (
  SELECT
    dc.cod_cliente,
    date_trunc('month'::text, dc.data_captacao::timestamp with time zone)::date AS mes_ref,
    sum(dc.valor_captacao) AS captacao_entradas
  FROM public.dados_captacoes dc
  WHERE dc.tipo_captacao <> 'TRANSF'::text
  GROUP BY dc.cod_cliente, (date_trunc('month'::text, dc.data_captacao::timestamp with time zone))
) cap ON cap.cod_cliente = t.cod_cliente
   AND cap.mes_ref = date_trunc('month'::text, t.data_transferencia::timestamp with time zone)::date
WHERE NOT (t.cod_assessor_destino_pad <> '-'::text AND t.cod_assessor_origem_pad <> '-'::text);

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
      WHEN t.cod_assessor_origem_pad = '-'::text THEN GREATEST(
        0::numeric,
        COALESCE(replace(dp.net_em_m, ','::text, '.'::text)::numeric, 0::numeric)
          - COALESCE(GREATEST(cap.captacao_entradas, 0::numeric), 0::numeric)
      )
      ELSE COALESCE(replace(dp.net_em_m, ','::text, '.'::text)::numeric, 0::numeric)
    END, 2) AS valor
FROM transf t
LEFT JOIN LATERAL (
  SELECT dp_mes.net_em_m
  FROM euro_dash.dados_positivador dp_mes
  WHERE dp_mes.cliente = t.cod_cliente
    AND date_trunc('month'::text, dp_mes.data_posicao::timestamp with time zone)
      = date_trunc('month'::text, t.data_transferencia::timestamp with time zone)
  ORDER BY dp_mes.data_posicao DESC, dp_mes.id DESC
  LIMIT 1
) dp ON true
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
