-- Script para adicionar coluna status na tabela dados_times
-- Execução: Execute este script no Supabase SQL Editor

-- 1. Adicionar coluna status com valor padrão 'ATIVO'
ALTER TABLE dados_times 
ADD COLUMN status TEXT NOT NULL DEFAULT 'ATIVO';

-- 2. Adicionar constraint para garantir que status seja apenas 'ATIVO' ou 'INATIVO'
ALTER TABLE dados_times 
ADD CONSTRAINT check_status_valid 
CHECK (status IN ('ATIVO', 'INATIVO'));

-- 3. Criar índice para melhorar performance nas consultas por status
CREATE INDEX IF NOT EXISTS idx_dados_times_status ON dados_times(status);

-- 4. Adicionar comentário na coluna para documentação
COMMENT ON COLUMN dados_times.status IS 'Status do time: ATIVO ou INATIVO';

-- 5. Atualizar todos os registros existentes para status 'ATIVO' (caso necessário)
UPDATE dados_times SET status = 'ATIVO' WHERE status IS NULL;

-- 6. Atualizar políticas RLS para incluir a nova coluna (se necessário)
-- As políticas existentes já cobrem todas as colunas, então não é necessário alterar

-- Verificação: Consultar a estrutura da tabela atualizada
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'dados_times' 
-- ORDER BY ordinal_position;