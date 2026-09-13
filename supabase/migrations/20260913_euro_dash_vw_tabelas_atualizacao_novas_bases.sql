CREATE OR REPLACE VIEW euro_dash.vw_tabelas_atualizacao AS
SELECT 'dados_captacoes'::text AS table_name,
    max(dados_captacoes.data_captacao) AS ultima_data_registro,
    max(dados_captacoes.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_captacoes
UNION ALL
 SELECT 'dados_positivador'::text AS table_name,
    max(dados_positivador.data_atualizacao) AS ultima_data_registro,
    max(dados_positivador.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_positivador
UNION ALL
 SELECT 'dados_cetipados'::text AS table_name,
    max(dados_cetipados.data) AS ultima_data_registro,
    max(dados_cetipados.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_cetipados
UNION ALL
 SELECT 'dados_rv_executadas'::text AS table_name,
    max(dados_rv_executadas.data_inclusao) AS ultima_data_registro,
    max(dados_rv_executadas.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_rv_executadas
UNION ALL
 SELECT 'dados_transferencias'::text AS table_name,
    max(dados_transferencias.data_transferencia) AS ultima_data_registro,
    max(dados_transferencias.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_transferencias
UNION ALL
 SELECT 'dados_rf_fluxo'::text AS table_name,
    max(dados_rf_fluxo.data) AS ultima_data_registro,
    max(dados_rf_fluxo.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_rf_fluxo
UNION ALL
 SELECT 'dados_pj_custodia'::text AS table_name,
    max(dados_pj_custodia.data_foto_custodia) AS ultima_data_registro,
    max(dados_pj_custodia.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_pj_custodia
UNION ALL
 SELECT 'dados_offshore_remessas'::text AS table_name,
    max(dados_offshore_remessas.date) AS ultima_data_registro,
    max(dados_offshore_remessas.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_offshore_remessas
UNION ALL
 SELECT 'dados_offshore_operacoes'::text AS table_name,
    max(dados_offshore_operacoes.date) AS ultima_data_registro,
    max(dados_offshore_operacoes.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_offshore_operacoes
UNION ALL
 SELECT 'dados_fp'::text AS table_name,
    max(dados_fp.data_criacao_fp) AS ultima_data_registro,
    max(dados_fp.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_fp
UNION ALL
 SELECT 'dados_dra_analitico'::text AS table_name,
    max(dados_dra_analitico.competencia) AS ultima_data_registro,
    max(dados_dra_analitico.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_dra_analitico
UNION ALL
 SELECT 'dados_fundos'::text AS table_name,
    max(dados_fundos_novo.data_liquidacao) AS ultima_data_registro,
    max(dados_fundos_novo.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_fundos_novo
UNION ALL
 SELECT 'dados_ofertas'::text AS table_name,
    max(dados_ofertas.data_liquidacao_prevista) AS ultima_data_registro,
    max(dados_ofertas.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_ofertas
UNION ALL
 SELECT 'dados_posicao_black'::text AS table_name,
    max(dados_posicao_black.data_registro) AS ultima_data_registro,
    max(dados_posicao_black.data_registro) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_posicao_black
UNION ALL
 SELECT 'dados_rupturas'::text AS table_name,
    max(dados_rupturas.periodo) AS ultima_data_registro,
    max(dados_rupturas.created_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_rupturas
UNION ALL
 SELECT 'dados_nps'::text AS table_name,
    max(dados_nps.data_resposta) AS ultima_data_registro,
    max(dados_nps.created_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_nps
UNION ALL
 SELECT 'dados_modelo_servir'::text AS table_name,
    max(dados_modelo_servir.periodo) AS ultima_data_registro,
    max(dados_modelo_servir.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_modelo_servir
UNION ALL
 SELECT 'dados_habilitacao_ativacao'::text AS table_name,
    max(dados_habilitacao_ativacao.data) AS ultima_data_registro,
    max(dados_habilitacao_ativacao.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_habilitacao_ativacao
UNION ALL
 SELECT 'dados_diversificador_full'::text AS table_name,
    max(dados_diversificador_full.data_posicao) AS ultima_data_registro,
    max(dados_diversificador_full.created_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_diversificador_full
UNION ALL
 SELECT 'dados_demonstrativo_full'::text AS table_name,
    max(dados_demonstrativo_full.data) AS ultima_data_registro,
    max(dados_demonstrativo_full.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_demonstrativo_full
UNION ALL
 SELECT 'dados_cambio'::text AS table_name,
    max(dados_cambio.data) AS ultima_data_registro,
    max(dados_cambio.updated_at::date) AS ultima_atualizacao,
    count(*) AS total_registros
   FROM euro_dash.dados_cambio;
