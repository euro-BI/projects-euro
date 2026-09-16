-- Antes a captura apagava todo histórico com data_posicao diferente da atual,
-- o que zerava a aba Diário a cada atualização. Mantém só o replace do dia (foto_em).

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

  -- Só regrava o dia corrente; histórico de outros dias permanece.
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
