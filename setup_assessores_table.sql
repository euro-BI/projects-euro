-- Script para configurar a tabela 'assessores' no banco de dados Supabase
-- Execute este script no SQL Editor do painel do Supabase

-- 1. Criar a tabela 'assessores'
CREATE TABLE IF NOT EXISTS public.assessores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  nome_exibicao TEXT NOT NULL,
  telefone TEXT,
  foto_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 3. Criar trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_assessores_updated_at ON public.assessores;
CREATE TRIGGER update_assessores_updated_at
  BEFORE UPDATE ON public.assessores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.assessores ENABLE ROW LEVEL SECURITY;

-- 5. Remover políticas existentes se houver
DROP POLICY IF EXISTS "Usuários autenticados podem ver assessores" ON public.assessores;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir assessores" ON public.assessores;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar assessores" ON public.assessores;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar assessores" ON public.assessores;

-- 6. Criar políticas de segurança (RLS)
-- Política para SELECT (visualizar)
CREATE POLICY "Usuários autenticados podem ver assessores"
ON public.assessores FOR SELECT
TO authenticated
USING (true);

-- Política para INSERT (inserir)
CREATE POLICY "Usuários autenticados podem inserir assessores"
ON public.assessores FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política para UPDATE (atualizar)
CREATE POLICY "Usuários autenticados podem atualizar assessores"
ON public.assessores FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Política para DELETE (deletar)
CREATE POLICY "Usuários autenticados podem deletar assessores"
ON public.assessores FOR DELETE
TO authenticated
USING (true);

-- 7. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_assessores_nome_completo ON public.assessores(nome_completo);
CREATE INDEX IF NOT EXISTS idx_assessores_nome_exibicao ON public.assessores(nome_exibicao);
CREATE INDEX IF NOT EXISTS idx_assessores_created_at ON public.assessores(created_at);

-- 8. Inserir dados de exemplo (opcional)
INSERT INTO public.assessores (nome_completo, nome_exibicao, telefone) VALUES 
('João Silva Santos', 'João Silva', '(11) 99999-9999'),
('Maria Oliveira Costa', 'Maria Oliveira', '(11) 88888-8888'),
('Pedro Souza Lima', 'Pedro Souza', '(11) 77777-7777')
ON CONFLICT DO NOTHING;

-- 9. Verificar se a tabela foi criada corretamente
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'assessores'
ORDER BY ordinal_position;

-- 10. Verificar políticas RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'assessores';