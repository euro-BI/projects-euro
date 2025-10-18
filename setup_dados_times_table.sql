-- Criação da tabela dados_times
-- Esta tabela armazena as informações dos times

CREATE TABLE IF NOT EXISTS dados_times (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    time_id TEXT UNIQUE NOT NULL,
    time TEXT NOT NULL,
    foto_url TEXT,
    cor_time TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para melhorar performance das consultas
CREATE UNIQUE INDEX IF NOT EXISTS idx_dados_times_time_id ON dados_times(time_id);
CREATE INDEX IF NOT EXISTS idx_dados_times_time ON dados_times(time);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_dados_times_updated_at 
    BEFORE UPDATE ON dados_times 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE dados_times IS 'Tabela que armazena as informações dos times';
COMMENT ON COLUMN dados_times.time_id IS 'Identificador único do time';
COMMENT ON COLUMN dados_times.time IS 'Nome do time';
COMMENT ON COLUMN dados_times.foto_url IS 'URL da foto/logo do time';
COMMENT ON COLUMN dados_times.cor_time IS 'Cor representativa do time (hex, rgb, etc.)';

-- Constraint para garantir que time_id não seja vazio
ALTER TABLE dados_times ADD CONSTRAINT check_time_id_not_empty CHECK (time_id != '');
ALTER TABLE dados_times ADD CONSTRAINT check_time_not_empty CHECK (time != '');

-- Habilitar RLS (Row Level Security)
ALTER TABLE dados_times ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Liberar tudo para usuários autenticados
CREATE POLICY "Usuários autenticados podem visualizar dados_times" 
    ON dados_times FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem inserir dados_times" 
    ON dados_times FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem atualizar dados_times" 
    ON dados_times FOR UPDATE 
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar dados_times" 
    ON dados_times FOR DELETE 
    USING (auth.role() = 'authenticated');