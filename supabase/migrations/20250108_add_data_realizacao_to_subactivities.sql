-- Migração para adicionar campo 'data_realizacao' na tabela projects_subactivities
-- Esta coluna armazenará a data e hora em que a subatividade foi concluída

-- Adicionar coluna data_realizacao
ALTER TABLE public.projects_subactivities
ADD COLUMN data_realizacao TIMESTAMP WITH TIME ZONE;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.projects_subactivities.data_realizacao IS 'Data e hora em que a subatividade foi marcada como concluída';

-- Verificar se a coluna foi adicionada corretamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects_subactivities' 
        AND column_name = 'data_realizacao'
    ) THEN
        RAISE NOTICE 'Coluna data_realizacao adicionada com sucesso à tabela projects_subactivities';
    ELSE
        RAISE EXCEPTION 'Falha ao adicionar coluna data_realizacao à tabela projects_subactivities';
    END IF;
END $$;