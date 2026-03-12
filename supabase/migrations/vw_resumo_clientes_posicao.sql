-- public.vw_resumo_clientes_posicao fonte

CREATE OR REPLACE VIEW public.vw_resumo_clientes_posicao
WITH(security_invoker=on)
AS WITH ultima_posicao AS (
         SELECT DISTINCT ON (dados_positivador.cliente) dados_positivador.cliente,
            dados_positivador.assessor AS cod_assessor_positivador,
            round(COALESCE(replace(dados_positivador.net_em_m, ','::text, '.'::text)::numeric, 0::numeric), 2) AS net_em_m,
            dados_positivador.data_posicao,
            dados_positivador.status,
            to_char(dados_positivador.data_posicao::timestamp with time zone, 'YYYYMM'::text) AS referencia_posicao,
            'A'::text || dados_positivador.assessor AS cod_assessor_completo,
            (to_char(dados_positivador.data_posicao::timestamp with time zone, 'YYYYMM'::text) || ' | '::text) || dados_positivador.cliente AS chave_data_cliente
           FROM dados_positivador
          WHERE dados_positivador.status = 'ATIVO'::text AND dados_positivador.net_em_m IS NOT NULL AND replace(replace(dados_positivador.net_em_m, '.'::text, ''::text), ','::text, '.'::text)::numeric > 0::numeric
          ORDER BY dados_positivador.cliente, dados_positivador.data_posicao DESC
        ), times_com_referencia AS (
         SELECT dados_times_historico.cod_assessor,
            dados_times_historico.pipe_id,
            dados_times_historico.cluster,
            dados_times_historico.time_id,
            dados_times_historico.lider,
            dados_times_historico.referencia,
            to_char(dados_times_historico.referencia::timestamp with time zone, 'YYYYMM'::text) AS referencia_formatada,
            dados_times_historico.status,
            dados_times_historico.meta_captacao,
            dados_times_historico.meta_ativacao_300k
           FROM dados_times_historico
        ), operacoes_base AS (
         SELECT dados_rv_executadas.codigo_cliente,
            dados_rv_executadas.operacao,
            dados_rv_executadas.data_inclusao,
            replace(replace(dados_rv_executadas.comissao, '.'::text, ''::text), ','::text, '.'::text)::numeric AS comissao
           FROM dados_rv_executadas
          WHERE dados_rv_executadas.data_inclusao IS NOT NULL
        ), operacoes_mensais AS (
         SELECT operacoes_base.codigo_cliente,
            date_trunc('month'::text, operacoes_base.data_inclusao::timestamp with time zone)::date AS data_mensal,
            max(operacoes_base.operacao) AS codigo_ultima_operacao_mes,
            sum(operacoes_base.comissao) AS comissao_total,
            count(operacoes_base.operacao) AS qtd_boletas,
            row_number() OVER (PARTITION BY operacoes_base.codigo_cliente ORDER BY (date_trunc('month'::text, operacoes_base.data_inclusao::timestamp with time zone)::date) DESC) AS rank_safra
           FROM operacoes_base
          GROUP BY operacoes_base.codigo_cliente, (date_trunc('month'::text, operacoes_base.data_inclusao::timestamp with time zone)::date)
        ), ultima_operacao AS (
         SELECT operacoes_mensais.codigo_cliente,
            operacoes_mensais.data_mensal AS data_ultima_operacao,
            operacoes_mensais.codigo_ultima_operacao_mes AS codigo_ultima_operacao,
            operacoes_mensais.comissao_total AS comissao_ultima_operacao,
            operacoes_mensais.qtd_boletas AS qtd_boletas_ultima_operacao
           FROM operacoes_mensais
          WHERE operacoes_mensais.rank_safra = 1
        ), penultima_operacao AS (
         SELECT operacoes_mensais.codigo_cliente,
            operacoes_mensais.data_mensal AS data_penultima_operacao,
            operacoes_mensais.codigo_ultima_operacao_mes AS codigo_penultima_operacao,
            operacoes_mensais.comissao_total AS comissao_penultima_operacao,
            operacoes_mensais.qtd_boletas AS qtd_boletas_penultima_operacao
           FROM operacoes_mensais
          WHERE operacoes_mensais.rank_safra = 2
        )
 SELECT up.cliente AS cod_cliente,
    dc.nome_cliente,
    th.cod_assessor,
    dcol.nome_completo AS nome_assessor,
    up.net_em_m,
    up.data_posicao AS data_ultima_posicao,
    up.status AS status_cliente,
    uo.data_ultima_operacao,
    uo.codigo_ultima_operacao,
    uo.comissao_ultima_operacao,
    uo.qtd_boletas_ultima_operacao,
    po.data_penultima_operacao,
    po.codigo_penultima_operacao,
    po.comissao_penultima_operacao,
    po.qtd_boletas_penultima_operacao,
        CASE
            WHEN uo.data_ultima_operacao IS NULL THEN 'SIM'::text
            WHEN (CURRENT_DATE - uo.data_ultima_operacao) > 365 THEN 'SIM'::text
            WHEN po.data_penultima_operacao IS NOT NULL AND (uo.data_ultima_operacao - po.data_penultima_operacao) > 365 THEN 'SIM'::text
            ELSE 'NÃO'::text
        END AS validado,
        CASE
            WHEN uo.data_ultima_operacao IS NOT NULL AND po.data_penultima_operacao IS NULL THEN 'SIM'::text
            WHEN uo.data_ultima_operacao IS NOT NULL AND po.data_penultima_operacao IS NOT NULL AND (uo.data_ultima_operacao - po.data_penultima_operacao) > 365 THEN 'SIM'::text
            WHEN uo.data_ultima_operacao IS NOT NULL THEN 'NÃO'::text
            ELSE NULL::text
        END AS era_validado,
        CASE
            WHEN (uo.data_ultima_operacao IS NOT NULL AND po.data_penultima_operacao IS NULL OR uo.data_ultima_operacao IS NOT NULL AND po.data_penultima_operacao IS NOT NULL AND (uo.data_ultima_operacao - po.data_penultima_operacao) > 365) AND uo.comissao_ultima_operacao > vwb.trigger THEN 'SIM'::text
            ELSE 'NÃO'::text
        END AS validado_bonus,
        CASE
            WHEN uo.data_ultima_operacao IS NULL THEN NULL::integer
            ELSE CURRENT_DATE - uo.data_ultima_operacao
        END AS dias_desde_ultima_operacao,
        CASE
            WHEN po.data_penultima_operacao IS NOT NULL THEN uo.data_ultima_operacao - po.data_penultima_operacao
            ELSE NULL::integer
        END AS dias_entre_operacoes,
    (up.referencia_posicao || ' | '::text) || up.cod_assessor_completo AS chave_data_assessor,
    up.chave_data_cliente,
    vwb.nivel,
    vwb.trigger,
    vwb.bonus,
    vwb.soma_valor_euro
   FROM ultima_posicao up
     LEFT JOIN dados_clientes dc ON up.cliente = dc.cod_cliente
     LEFT JOIN times_com_referencia th ON th.referencia_formatada = up.referencia_posicao AND th.cod_assessor = up.cod_assessor_completo
     LEFT JOIN dados_colaboradores dcol ON th.cod_assessor = dcol.cod_assessor
     LEFT JOIN ultima_operacao uo ON up.cliente = uo.codigo_cliente
     LEFT JOIN penultima_operacao po ON up.cliente = po.codigo_cliente
     LEFT JOIN vw_resumo_assessor_posicao_black vwb ON vwb.codigo_assessor = up.cod_assessor_completo
  ORDER BY up.cliente;