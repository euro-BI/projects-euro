-- Script para configurar a tabela 'captacoes' no banco de dados Supabase
-- Execute este script no SQL Editor do painel do Supabase

-- 1. Criar a tabela 'dados_captacoes'
CREATE TABLE IF NOT EXISTS public.dados_captacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_captacao DATE NOT NULL,
  cod_assessor TEXT NOT NULL,
  cod_cliente TEXT NOT NULL,
  tipo_captacao TEXT NOT NULL,
  aux TEXT,
  valor_captacao DECIMAL(15,2) NOT NULL,
  data_atualizacao DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo_pessoa TEXT NOT NULL,
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
DROP TRIGGER IF EXISTS update_dados_captacoes_updated_at ON public.dados_captacoes;
CREATE TRIGGER update_dados_captacoes_updated_at
  BEFORE UPDATE ON public.dados_captacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.dados_captacoes ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas de acesso
-- Política para visualização (usuários autenticados podem ver)
CREATE POLICY "Usuários autenticados podem ver captações" ON public.dados_captacoes
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para inserção (usuários autenticados podem inserir)
CREATE POLICY "Usuários autenticados podem inserir captações" ON public.dados_captacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política para atualização (usuários autenticados podem atualizar)
CREATE POLICY "Usuários autenticados podem atualizar captações" ON public.dados_captacoes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política para exclusão (usuários autenticados podem excluir)
CREATE POLICY "Usuários autenticados podem excluir captações" ON public.dados_captacoes
  FOR DELETE
  TO authenticated
  USING (true);

-- 6. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_dados_captacoes_data_captacao ON public.dados_captacoes(data_captacao);
CREATE INDEX IF NOT EXISTS idx_dados_captacoes_cod_assessor ON public.dados_captacoes(cod_assessor);
CREATE INDEX IF NOT EXISTS idx_dados_captacoes_cod_cliente ON public.dados_captacoes(cod_cliente);
CREATE INDEX IF NOT EXISTS idx_dados_captacoes_tipo_captacao ON public.dados_captacoes(tipo_captacao);
CREATE INDEX IF NOT EXISTS idx_dados_captacoes_created_at ON public.dados_captacoes(created_at);

-- 7. Comentários para documentação
COMMENT ON TABLE public.dados_captacoes IS 'Tabela para armazenar dados de captações importados de planilhas Excel';
COMMENT ON COLUMN public.dados_captacoes.data_captacao IS 'Data da captação';
COMMENT ON COLUMN public.dados_captacoes.cod_assessor IS 'Código do assessor responsável';
COMMENT ON COLUMN public.dados_captacoes.cod_cliente IS 'Código do cliente';
COMMENT ON COLUMN public.dados_captacoes.tipo_captacao IS 'Tipo de captação realizada';
COMMENT ON COLUMN public.dados_captacoes.aux IS 'Campo auxiliar para informações adicionais';
COMMENT ON COLUMN public.dados_captacoes.valor_captacao IS 'Valor da captação em decimal';
COMMENT ON COLUMN public.dados_captacoes.data_atualizacao IS 'Data de atualização do registro';
COMMENT ON COLUMN public.dados_captacoes.tipo_pessoa IS 'Tipo de pessoa (física/jurídica)';