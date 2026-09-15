CREATE TABLE IF NOT EXISTS euro_dash.mv_resumo_assessor_diario AS
SELECT
  (timezone('America/Sao_Paulo', now()))::date AS foto_em,
  now() AS created_at,
  NULL::uuid AS created_by,
  m.*
FROM euro_dash.mv_resumo_assessor m
WHERE false;

ALTER TABLE euro_dash.mv_resumo_assessor_diario
  ALTER COLUMN foto_em SET DEFAULT (timezone('America/Sao_Paulo', now()))::date,
  ALTER COLUMN foto_em SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mv_resumo_assessor_diario_foto_assessor_idx
  ON euro_dash.mv_resumo_assessor_diario (foto_em, cod_assessor);

CREATE INDEX IF NOT EXISTS mv_resumo_assessor_diario_data_posicao_idx
  ON euro_dash.mv_resumo_assessor_diario (data_posicao, foto_em);

GRANT ALL ON TABLE euro_dash.mv_resumo_assessor_diario TO service_role;
GRANT SELECT ON TABLE euro_dash.mv_resumo_assessor_diario TO authenticated;

CREATE OR REPLACE FUNCTION euro_dash.capture_resumo_assessor_diario(p_created_by uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = euro_dash
SET statement_timeout = '0'
AS $$
DECLARE
  v_data date;
  v_foto date;
  v_linhas integer;
BEGIN
  v_foto := (timezone('America/Sao_Paulo', now()))::date;
  SELECT max(data_posicao) INTO v_data FROM euro_dash.mv_resumo_assessor;
  IF v_data IS NULL THEN
    RAISE EXCEPTION 'mv_resumo_assessor sem data_posicao';
  END IF;

  DELETE FROM euro_dash.mv_resumo_assessor_diario
  WHERE data_posicao IS DISTINCT FROM v_data;

  DELETE FROM euro_dash.mv_resumo_assessor_diario
  WHERE foto_em = v_foto;

  INSERT INTO euro_dash.mv_resumo_assessor_diario
  SELECT v_foto, now(), p_created_by, m.*
  FROM euro_dash.mv_resumo_assessor m
  WHERE m.data_posicao = v_data;

  GET DIAGNOSTICS v_linhas = ROW_COUNT;

  RETURN jsonb_build_object(
    'foto_em', v_foto,
    'data_posicao', v_data,
    'linhas', v_linhas
  );
END;
$$;

REVOKE ALL ON FUNCTION euro_dash.capture_resumo_assessor_diario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION euro_dash.capture_resumo_assessor_diario(uuid) TO service_role;
