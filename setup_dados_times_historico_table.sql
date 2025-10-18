-- Criação da tabela dados_times_historico
-- Esta tabela armazena o histórico de times dos colaboradores

CREATE TABLE IF NOT EXISTS dados_times_historico (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cod_assessor TEXT NOT NULL,
    pipe_id TEXT NOT NULL,
    cluster TEXT NOT NULL,
    time_id TEXT NOT NULL,
    lider BOOLEAN NOT NULL DEFAULT FALSE,
    referencia DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para melhorar performance das consultas
CREATE INDEX IF NOT EXISTS idx_dados_times_historico_cod_assessor ON dados_times_historico(cod_assessor);
CREATE INDEX IF NOT EXISTS idx_dados_times_historico_pipe_id ON dados_times_historico(pipe_id);
CREATE INDEX IF NOT EXISTS idx_dados_times_historico_time_id ON dados_times_historico(time_id);
CREATE INDEX IF NOT EXISTS idx_dados_times_historico_referencia ON dados_times_historico(referencia);
CREATE INDEX IF NOT EXISTS idx_dados_times_historico_lider ON dados_times_historico(lider);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dados_times_historico_updated_at 
    BEFORE UPDATE ON dados_times_historico 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE dados_times_historico IS 'Tabela que armazena o histórico de times dos colaboradores';
COMMENT ON COLUMN dados_times_historico.cod_assessor IS 'Código do assessor/colaborador';
COMMENT ON COLUMN dados_times_historico.pipe_id IS 'Identificador do pipe';
COMMENT ON COLUMN dados_times_historico.cluster IS 'Cluster ao qual o colaborador pertence';
COMMENT ON COLUMN dados_times_historico.time_id IS 'Identificador do time';
COMMENT ON COLUMN dados_times_historico.lider IS 'Indica se o colaborador é líder do time';
COMMENT ON COLUMN dados_times_historico.referencia IS 'Data de referência do registro';

-- Habilitar RLS (Row Level Security)
ALTER TABLE dados_times_historico ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Liberar tudo para usuários autenticados
CREATE POLICY "Usuários autenticados podem visualizar dados_times_historico" 
    ON dados_times_historico FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem inserir dados_times_historico" 
    ON dados_times_historico FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem atualizar dados_times_historico" 
    ON dados_times_historico FOR UPDATE 
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar dados_times_historico" 
    ON dados_times_historico FOR DELETE 
    USING (auth.role() = 'authenticated');