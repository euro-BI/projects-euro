CREATE TABLE IF NOT EXISTS euro_dash.dash_refresh_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  data_posicao date NOT NULL,
  created_by uuid,
  metrics jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS dash_refresh_snapshots_created_at_idx
  ON euro_dash.dash_refresh_snapshots (created_at DESC);

GRANT ALL ON TABLE euro_dash.dash_refresh_snapshots TO service_role;
GRANT SELECT ON TABLE euro_dash.dash_refresh_snapshots TO authenticated;

CREATE OR REPLACE FUNCTION euro_dash.capture_dash_refresh_snapshot(p_created_by uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = euro_dash
SET statement_timeout = '0'
AS $$
DECLARE
  v_data date;
  v_metrics jsonb;
  v_current euro_dash.dash_refresh_snapshots%ROWTYPE;
  v_previous euro_dash.dash_refresh_snapshots%ROWTYPE;
BEGIN
  SELECT max(data_posicao) INTO v_data FROM euro_dash.mv_resumo_assessor;
  IF v_data IS NULL THEN
    RAISE EXCEPTION 'mv_resumo_assessor sem data_posicao';
  END IF;

  WITH dates AS (
    SELECT table_name, ultima_data_registro
    FROM euro_dash.vw_tabelas_atualizacao
  ),
  totals AS (
    SELECT
      coalesce(sum(receita_renda_fixa), 0) AS receita_renda_fixa,
      coalesce(sum(receitas_ofertas_fundos), 0) AS receitas_ofertas_fundos,
      coalesce(sum(receitas_ofertas_rf), 0) AS receitas_ofertas_rf,
      coalesce(sum(receita_cetipados), 0) AS receita_cetipados,
      coalesce(sum(receitas_offshore), 0) AS receitas_offshore,
      coalesce(sum(receitas_estruturadas), 0) AS receitas_estruturadas,
      coalesce(sum(receita_b3), 0) AS receita_b3,
      coalesce(sum(receita_seguros), 0) AS receita_seguros,
      coalesce(sum(receita_previdencia), 0) AS receita_previdencia,
      coalesce(sum(receita_consorcios), 0) AS receita_consorcios,
      coalesce(sum(receita_cambio), 0) AS receita_cambio,
      coalesce(sum(receita_cambio_pf), 0) AS receita_cambio_pf,
      coalesce(sum(receita_cambio_pj), 0) AS receita_cambio_pj,
      coalesce(sum(captacao_entradas), 0) AS captacao_entradas,
      coalesce(sum(captacao_saidas), 0) AS captacao_saidas,
      coalesce(sum(captacao_liquida), 0) AS captacao_liquida,
      coalesce(sum(captacao_entrada_transf), 0) AS captacao_entrada_transf,
      coalesce(sum(captacao_saida_transf), 0) AS captacao_saida_transf,
      coalesce(sum(captacao_transf_liquida), 0) AS captacao_transf_liquida
    FROM euro_dash.mv_resumo_assessor
    WHERE data_posicao = v_data
  )
  SELECT jsonb_build_array(
    jsonb_build_object('key', 'receita_renda_fixa', 'label', 'Renda fixa', 'valor', t.receita_renda_fixa, 'ultima_data_registro', d_rf.ultima_data_registro),
    jsonb_build_object('key', 'receitas_ofertas_fundos', 'label', 'Ofertas fundos', 'valor', t.receitas_ofertas_fundos, 'ultima_data_registro', d_fundos.ultima_data_registro),
    jsonb_build_object('key', 'receitas_ofertas_rf', 'label', 'Ofertas RF', 'valor', t.receitas_ofertas_rf, 'ultima_data_registro', d_ofertas.ultima_data_registro),
    jsonb_build_object('key', 'receita_cetipados', 'label', 'Cetipados', 'valor', t.receita_cetipados, 'ultima_data_registro', d_cetip.ultima_data_registro),
    jsonb_build_object('key', 'receitas_offshore', 'label', 'Offshore', 'valor', t.receitas_offshore, 'ultima_data_registro', d_off.ultima_data_registro),
    jsonb_build_object('key', 'receitas_estruturadas', 'label', 'Estruturadas', 'valor', t.receitas_estruturadas, 'ultima_data_registro', d_rv.ultima_data_registro),
    jsonb_build_object('key', 'receita_b3', 'label', 'B3', 'valor', t.receita_b3, 'ultima_data_registro', d_pos.ultima_data_registro),
    jsonb_build_object('key', 'receita_seguros', 'label', 'Seguros', 'valor', t.receita_seguros, 'ultima_data_registro', d_demo.ultima_data_registro),
    jsonb_build_object('key', 'receita_previdencia', 'label', 'Previdência', 'valor', t.receita_previdencia, 'ultima_data_registro', d_demo.ultima_data_registro),
    jsonb_build_object('key', 'receita_consorcios', 'label', 'Consórcios', 'valor', t.receita_consorcios, 'ultima_data_registro', d_demo.ultima_data_registro),
    jsonb_build_object('key', 'receita_cambio', 'label', 'Câmbio', 'valor', t.receita_cambio, 'ultima_data_registro', d_cambio.ultima_data_registro),
    jsonb_build_object('key', 'receita_cambio_pf', 'label', 'Câmbio PF', 'valor', t.receita_cambio_pf, 'ultima_data_registro', d_cambio.ultima_data_registro),
    jsonb_build_object('key', 'receita_cambio_pj', 'label', 'Câmbio PJ', 'valor', t.receita_cambio_pj, 'ultima_data_registro', d_cambio.ultima_data_registro),
    jsonb_build_object('key', 'captacao_entradas', 'label', 'Captação entradas', 'valor', t.captacao_entradas, 'ultima_data_registro', d_cap.ultima_data_registro),
    jsonb_build_object('key', 'captacao_saidas', 'label', 'Captação saídas', 'valor', t.captacao_saidas, 'ultima_data_registro', d_cap.ultima_data_registro),
    jsonb_build_object('key', 'captacao_liquida', 'label', 'Captação líquida', 'valor', t.captacao_liquida, 'ultima_data_registro', d_cap.ultima_data_registro),
    jsonb_build_object('key', 'captacao_entrada_transf', 'label', 'Transferência entradas', 'valor', t.captacao_entrada_transf, 'ultima_data_registro', d_tr.ultima_data_registro),
    jsonb_build_object('key', 'captacao_saida_transf', 'label', 'Transferência saídas', 'valor', t.captacao_saida_transf, 'ultima_data_registro', d_tr.ultima_data_registro),
    jsonb_build_object('key', 'captacao_transf_liquida', 'label', 'Transferência líquida', 'valor', t.captacao_transf_liquida, 'ultima_data_registro', d_tr.ultima_data_registro)
  )
  INTO v_metrics
  FROM totals t
  LEFT JOIN dates d_rf ON d_rf.table_name = 'dados_rf_fluxo'
  LEFT JOIN dates d_fundos ON d_fundos.table_name = 'dados_fundos'
  LEFT JOIN dates d_ofertas ON d_ofertas.table_name = 'dados_ofertas'
  LEFT JOIN dates d_cetip ON d_cetip.table_name = 'dados_cetipados'
  LEFT JOIN dates d_off ON d_off.table_name = 'dados_offshore_remessas'
  LEFT JOIN dates d_rv ON d_rv.table_name = 'dados_rv_executadas'
  LEFT JOIN dates d_pos ON d_pos.table_name = 'dados_positivador'
  LEFT JOIN dates d_cambio ON d_cambio.table_name = 'dados_cambio'
  LEFT JOIN dates d_cap ON d_cap.table_name = 'dados_captacoes'
  LEFT JOIN dates d_tr ON d_tr.table_name = 'dados_transferencias'
  LEFT JOIN dates d_demo ON d_demo.table_name = 'dados_demonstrativo_full';

  INSERT INTO euro_dash.dash_refresh_snapshots (data_posicao, created_by, metrics)
  VALUES (v_data, p_created_by, v_metrics)
  RETURNING * INTO v_current;

  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY created_at DESC) AS rn
    FROM euro_dash.dash_refresh_snapshots
  )
  DELETE FROM euro_dash.dash_refresh_snapshots s
  USING ranked
  WHERE s.id = ranked.id AND ranked.rn > 2;

  SELECT * INTO v_previous
  FROM euro_dash.dash_refresh_snapshots
  WHERE id <> v_current.id
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'current', jsonb_build_object(
      'id', v_current.id,
      'created_at', v_current.created_at,
      'data_posicao', v_current.data_posicao,
      'metrics', v_current.metrics
    ),
    'previous', CASE
      WHEN v_previous.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', v_previous.id,
        'created_at', v_previous.created_at,
        'data_posicao', v_previous.data_posicao,
        'metrics', v_previous.metrics
      )
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION euro_dash.capture_dash_refresh_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION euro_dash.capture_dash_refresh_snapshot(uuid) TO service_role;
