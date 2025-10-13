-- Script para converter todas as colunas numéricas da tabela dados_positivador para TEXT
-- Execute este script no seu banco de dados Supabase

-- Converter todas as colunas DECIMAL para TEXT
ALTER TABLE public.dados_positivador 
ALTER COLUMN aplicacao_financeira_declarada_ajustada TYPE TEXT USING aplicacao_financeira_declarada_ajustada::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN receita_no_mes TYPE TEXT USING receita_no_mes::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN receita_bovespa TYPE TEXT USING receita_bovespa::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN receita_futuros TYPE TEXT USING receita_futuros::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN receita_rf_bancarios TYPE TEXT USING receita_rf_bancarios::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN receita_rf_privados TYPE TEXT USING receita_rf_privados::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN receita_rf_publicos TYPE TEXT USING receita_rf_publicos::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN captacao_bruta_em_m TYPE TEXT USING captacao_bruta_em_m::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN resgate_em_m TYPE TEXT USING resgate_em_m::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN captacao_liquida_em_m TYPE TEXT USING captacao_liquida_em_m::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN captacao_ted TYPE TEXT USING captacao_ted::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN captacao_st TYPE TEXT USING captacao_st::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN captacao_ota TYPE TEXT USING captacao_ota::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN captacao_rf TYPE TEXT USING captacao_rf::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN captacao_td TYPE TEXT USING captacao_td::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN captacao_prev TYPE TEXT USING captacao_prev::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN net_em_m_1 TYPE TEXT USING net_em_m_1::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN net_em_m TYPE TEXT USING net_em_m::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN net_renda_fixa TYPE TEXT USING net_renda_fixa::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN net_fundos_imobiliarios TYPE TEXT USING net_fundos_imobiliarios::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN net_renda_variavel TYPE TEXT USING net_renda_variavel::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN net_fundos TYPE TEXT USING net_fundos::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN net_financeiro TYPE TEXT USING net_financeiro::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN net_previdencia TYPE TEXT USING net_previdencia::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN net_outros TYPE TEXT USING net_outros::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN receita_aluguel TYPE TEXT USING receita_aluguel::TEXT;

ALTER TABLE public.dados_positivador 
ALTER COLUMN receita_complemento_pacote_corretagem TYPE TEXT USING receita_complemento_pacote_corretagem::TEXT;

-- Verificar a estrutura da tabela após as alterações
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'dados_positivador' AND table_schema = 'public' 
-- ORDER BY ordinal_position;