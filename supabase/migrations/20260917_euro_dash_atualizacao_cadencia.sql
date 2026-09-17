-- Cadência de atualização das bases (editável pela tela de Atualização).

CREATE TABLE IF NOT EXISTS euro_dash.atualizacao_cadencia (
  table_name text PRIMARY KEY,
  cadence text NOT NULL
    CHECK (cadence IN ('daily', 'every_2_days', 'weekly', 'monthly')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE euro_dash.atualizacao_cadencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atualizacao_cadencia_select ON euro_dash.atualizacao_cadencia;
CREATE POLICY atualizacao_cadencia_select
  ON euro_dash.atualizacao_cadencia
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS atualizacao_cadencia_write ON euro_dash.atualizacao_cadencia;
CREATE POLICY atualizacao_cadencia_write
  ON euro_dash.atualizacao_cadencia
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON euro_dash.atualizacao_cadencia TO authenticated;
GRANT ALL ON euro_dash.atualizacao_cadencia TO service_role;

INSERT INTO euro_dash.atualizacao_cadencia (table_name, cadence) VALUES
  ('dados_captacoes', 'daily'),
  ('dados_positivador', 'daily'),
  ('dados_rf_fluxo', 'daily'),
  ('dados_rv_executadas', 'daily'),
  ('dados_pj_custodia', 'daily'),
  ('dados_transferencias', 'daily'),
  ('dados_cambio', 'daily'),
  ('dados_offshore_remessas', 'daily'),
  ('dados_offshore_operacoes', 'daily'),
  ('dados_cetipados', 'every_2_days'),
  ('dados_posicao_black', 'every_2_days'),
  ('dados_nps', 'every_2_days'),
  ('dados_diversificador', 'every_2_days'),
  ('dados_diversificador_full', 'every_2_days'),
  ('dados_fundos', 'weekly'),
  ('dados_fundos_novo', 'weekly'),
  ('dados_habilitacao_ativacao', 'weekly'),
  ('dados_ofertas', 'weekly'),
  ('dados_rupturas', 'weekly'),
  ('dados_fp', 'monthly'),
  ('dados_modelo_servir', 'monthly'),
  ('dados_demonstrativo_full', 'monthly'),
  ('dados_dra_analitico', 'monthly')
ON CONFLICT (table_name) DO NOTHING;
