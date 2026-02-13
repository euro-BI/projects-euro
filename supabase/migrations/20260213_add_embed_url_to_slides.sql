-- Add embed_url column to tv_presentation_slides
ALTER TABLE public.tv_presentation_slides ADD COLUMN IF NOT EXISTS embed_url TEXT;
