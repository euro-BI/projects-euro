CREATE OR REPLACE FUNCTION euro_dash.refresh_dashboard_view(view_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = euro_dash
AS $$
DECLARE
  started timestamptz := clock_timestamp();
BEGIN
  PERFORM set_config('statement_timeout', '600000', true);

  IF view_name = 'mv_resumo_assessor' THEN
    REFRESH MATERIALIZED VIEW euro_dash.mv_resumo_assessor;
  ELSIF view_name = 'mv_detalhamento_ativacoes' THEN
    REFRESH MATERIALIZED VIEW euro_dash.mv_detalhamento_ativacoes;
  ELSE
    RAISE EXCEPTION 'Visão inválida: %', view_name;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'view', view_name,
    'elapsed_ms', (EXTRACT(EPOCH FROM (clock_timestamp() - started)) * 1000)::integer
  );
END;
$$;

REVOKE ALL ON FUNCTION euro_dash.refresh_dashboard_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION euro_dash.refresh_dashboard_view(text) TO service_role;
