-- Quem registrou / alterou o lançamento de consórcio.

ALTER TABLE euro_dash.dados_consorcio
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_by_nome text,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by_nome text;

CREATE INDEX IF NOT EXISTS dados_consorcio_created_by_idx
  ON euro_dash.dados_consorcio (created_by);
