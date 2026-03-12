-- public.vw_resumo_assessor_posicao_black fonte

CREATE OR REPLACE VIEW public.vw_resumo_assessor_posicao_black
WITH(security_invoker=on)
AS WITH ultima_referencia_times AS (
         SELECT DISTINCT ON (dados_times_historico.cod_assessor) dados_times_historico.cod_assessor,
            dados_times_historico.referencia,
            to_char(dados_times_historico.referencia::timestamp with time zone, 'YYYYMM'::text) AS referencia_formatada
           FROM dados_times_historico
          ORDER BY dados_times_historico.cod_assessor, dados_times_historico.referencia DESC
        ), dados_black_processados AS (
         SELECT dados_posicao_black.codigo_cliente,
            dados_posicao_black.codigo_assessor,
            dados_posicao_black.codigo_operacao,
            dados_posicao_black.data_registro,
            dados_posicao_black.ativo,
            dados_posicao_black.estrutura,
                CASE
                    WHEN lower(dados_posicao_black.estrutura) ~~ '%put%'::text OR lower(dados_posicao_black.estrutura) ~~ '%call%'::text THEN 'ESPECULATIVA'::text
                    ELSE 'ALOCAÇÃO'::text
                END AS tipo_alocacao,
            NULLIF(replace(replace(dados_posicao_black.quantidade_boleta_1, '.'::text, ''::text), ','::text, '.'::text), ''::text)::numeric AS quantidade_boleta_1_num,
            NULLIF(replace(replace(dados_posicao_black.quantidade_boleta_2, '.'::text, ''::text), ','::text, '.'::text), ''::text)::numeric AS quantidade_boleta_2_num,
            NULLIF(replace(replace(dados_posicao_black.valor_ativo, '.'::text, ''::text), ','::text, '.'::text), ''::text)::numeric AS valor_ativo_num,
            NULLIF(replace(replace(dados_posicao_black.custo_unitario_cliente, '.'::text, ''::text), ','::text, '.'::text), ''::text)::numeric AS custo_unitario_cliente_num
           FROM dados_posicao_black
          WHERE dados_posicao_black.data_registro IS NOT NULL
        ), dados_com_valor_euro AS (
         SELECT dados_black_processados.codigo_cliente,
            dados_black_processados.codigo_assessor,
            dados_black_processados.codigo_operacao,
            dados_black_processados.data_registro,
            dados_black_processados.ativo,
            dados_black_processados.estrutura,
            dados_black_processados.tipo_alocacao,
            dados_black_processados.quantidade_boleta_1_num,
            dados_black_processados.quantidade_boleta_2_num,
            dados_black_processados.valor_ativo_num,
            dados_black_processados.custo_unitario_cliente_num,
                CASE
                    WHEN dados_black_processados.quantidade_boleta_1_num IS NULL OR dados_black_processados.quantidade_boleta_1_num = 0::numeric THEN COALESCE(dados_black_processados.quantidade_boleta_2_num, 0::numeric)
                    ELSE dados_black_processados.quantidade_boleta_1_num
                END AS qtde_valida,
                CASE
                    WHEN
                    CASE
                        WHEN lower(dados_black_processados.estrutura) ~~ '%put%'::text OR lower(dados_black_processados.estrutura) ~~ '%call%'::text THEN 'ESPECULATIVA'::text
                        ELSE 'ALOCAÇÃO'::text
                    END = 'ALOCAÇÃO'::text THEN abs(
                    CASE
                        WHEN dados_black_processados.quantidade_boleta_1_num IS NULL OR dados_black_processados.quantidade_boleta_1_num = 0::numeric THEN COALESCE(dados_black_processados.quantidade_boleta_2_num, 0::numeric)
                        ELSE dados_black_processados.quantidade_boleta_1_num
                    END) * COALESCE(dados_black_processados.valor_ativo_num, 0::numeric)
                    WHEN
                    CASE
                        WHEN lower(dados_black_processados.estrutura) ~~ '%put%'::text OR lower(dados_black_processados.estrutura) ~~ '%call%'::text THEN 'ESPECULATIVA'::text
                        ELSE 'ALOCAÇÃO'::text
                    END = 'ESPECULATIVA'::text THEN abs(
                    CASE
                        WHEN dados_black_processados.quantidade_boleta_1_num IS NULL OR dados_black_processados.quantidade_boleta_1_num = 0::numeric THEN COALESCE(dados_black_processados.quantidade_boleta_2_num, 0::numeric)
                        ELSE dados_black_processados.quantidade_boleta_1_num
                    END) * abs(COALESCE(dados_black_processados.custo_unitario_cliente_num, 0::numeric))
                    ELSE NULL::numeric
                END AS valor_euro
           FROM dados_black_processados
        )
 SELECT (urt.referencia_formatada || ' | '::text) || dbp.codigo_assessor AS chave_data_assessor,
    urt.referencia_formatada,
    dbp.codigo_assessor,
    sum(dbp.valor_euro) AS soma_valor_euro,
        CASE
            WHEN sum(dbp.valor_euro) <= 200000::numeric THEN 'Nível 1'::text
            WHEN sum(dbp.valor_euro) <= 800000::numeric THEN 'Nível 2'::text
            WHEN sum(dbp.valor_euro) <= 2000000::numeric THEN 'Nível 3'::text
            WHEN sum(dbp.valor_euro) <= 5000000::numeric THEN 'Nível 4'::text
            WHEN sum(dbp.valor_euro) > 5000000::numeric THEN 'Nível 5'::text
            ELSE NULL::text
        END AS nivel,
        CASE
            WHEN sum(dbp.valor_euro) <= 200000::numeric THEN 500::numeric
            WHEN sum(dbp.valor_euro) <= 800000::numeric THEN 500::numeric
            WHEN sum(dbp.valor_euro) <= 2000000::numeric THEN 600::numeric
            WHEN sum(dbp.valor_euro) <= 5000000::numeric THEN 700::numeric
            WHEN sum(dbp.valor_euro) > 5000000::numeric THEN 900::numeric
            ELSE NULL::numeric
        END AS trigger,
        CASE
            WHEN sum(dbp.valor_euro) <= 200000::numeric THEN 50::numeric
            WHEN sum(dbp.valor_euro) <= 800000::numeric THEN 60::numeric
            WHEN sum(dbp.valor_euro) <= 2000000::numeric THEN 70::numeric
            WHEN sum(dbp.valor_euro) <= 5000000::numeric THEN 80::numeric
            WHEN sum(dbp.valor_euro) > 5000000::numeric THEN 100::numeric
            ELSE NULL::numeric
        END AS bonus
   FROM dados_com_valor_euro dbp
     JOIN ultima_referencia_times urt ON dbp.codigo_assessor = urt.cod_assessor
  GROUP BY urt.referencia_formatada, dbp.codigo_assessor
  ORDER BY urt.referencia_formatada DESC, dbp.codigo_assessor;