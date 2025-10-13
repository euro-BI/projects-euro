-- Migração para adicionar campo 'peso' na tabela projects_subactivities
-- Data: 12/12/2024
-- Objetivo: Implementar gestão de peso em subtarefas

-- Adicionar campo peso com valor padrão 0 (indica "Calcular com IA")
ALTER TABLE public.projects_subactivities 
ADD COLUMN peso INTEGER NOT NULL DEFAULT 0;

-- Comentário explicativo sobre o campo
COMMENT ON COLUMN public.projects_subactivities.peso IS 'Peso da subatividade. Valor 0 indica que deve ser calculado com IA';

-- Verificar se a coluna foi adicionada corretamente
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'projects_subactivities'
  AND column_name = 'peso';