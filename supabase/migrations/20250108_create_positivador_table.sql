-- Create positivador table
CREATE TABLE IF NOT EXISTS public.dados_positivador (
    id BIGSERIAL PRIMARY KEY,
    assessor TEXT NOT NULL,
    cliente TEXT NOT NULL,
    profissao TEXT,
    sexo TEXT,
    segmento TEXT,
    data_cadastro DATE,
    fez_segundo_aporte TEXT,
    data_nascimento DATE,
    status TEXT,
    ativou_em_m TEXT,
    evadiu_em_m TEXT,
    operou_bolsa TEXT,
    operou_fundo TEXT,
    operou_renda_fixa TEXT,
    aplicacao_financeira_declarada_ajustada DECIMAL(15,2),
    receita_no_mes DECIMAL(15,2),
    receita_bovespa DECIMAL(15,2),
    receita_futuros DECIMAL(15,2),
    receita_rf_bancarios DECIMAL(15,2),
    receita_rf_privados DECIMAL(15,2),
    receita_rf_publicos DECIMAL(15,2),
    captacao_bruta_em_m DECIMAL(15,2),
    resgate_em_m DECIMAL(15,2),
    captacao_liquida_em_m DECIMAL(15,2),
    captacao_ted DECIMAL(15,2),
    captacao_st DECIMAL(15,2),
    captacao_ota DECIMAL(15,2),
    captacao_rf DECIMAL(15,2),
    captacao_td DECIMAL(15,2),
    captacao_prev DECIMAL(15,2),
    net_em_m_1 DECIMAL(15,2),
    net_em_m DECIMAL(15,2),
    net_renda_fixa DECIMAL(15,2),
    net_fundos_imobiliarios DECIMAL(15,2),
    net_renda_variavel DECIMAL(15,2),
    net_fundos DECIMAL(15,2),
    net_financeiro DECIMAL(15,2),
    net_previdencia DECIMAL(15,2),
    net_outros DECIMAL(15,2),
    receita_aluguel DECIMAL(15,2),
    receita_complemento_pacote_corretagem DECIMAL(15,2),
    tipo_pessoa TEXT,
    data_posicao DATE NOT NULL,
    data_atualizacao DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint for duplicate detection (assessor, cliente, data_posicao)
CREATE UNIQUE INDEX IF NOT EXISTS idx_positivador_unique 
ON public.dados_positivador (assessor, cliente, data_posicao);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_positivador_assessor ON public.dados_positivador (assessor);
CREATE INDEX IF NOT EXISTS idx_positivador_cliente ON public.dados_positivador (cliente);
CREATE INDEX IF NOT EXISTS idx_positivador_data_posicao ON public.dados_positivador (data_posicao);
CREATE INDEX IF NOT EXISTS idx_positivador_data_atualizacao ON public.dados_positivador (data_atualizacao);

-- Enable Row Level Security
ALTER TABLE public.dados_positivador ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow authenticated users to view positivador data" ON public.dados_positivador
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert positivador data" ON public.dados_positivador
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update positivador data" ON public.dados_positivador
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete positivador data" ON public.dados_positivador
    FOR DELETE USING (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dados_positivador_updated_at 
    BEFORE UPDATE ON public.dados_positivador 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();