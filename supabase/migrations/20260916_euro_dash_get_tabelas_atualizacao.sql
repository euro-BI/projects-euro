-- public espelha euro_dash; RPC estável para a tela de atualização.

CREATE OR REPLACE VIEW public.vw_tabelas_atualizacao AS
SELECT * FROM euro_dash.vw_tabelas_atualizacao;

GRANT SELECT ON public.vw_tabelas_atualizacao TO anon, authenticated, service_role;
GRANT SELECT ON euro_dash.vw_tabelas_atualizacao TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION euro_dash.get_tabelas_atualizacao()
RETURNS TABLE (
  table_name text,
  ultima_data_registro date,
  ultima_atualizacao date,
  total_registros bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = euro_dash
SET statement_timeout = '60s'
AS $$
  SELECT
    v.table_name,
    v.ultima_data_registro::date,
    v.ultima_atualizacao::date,
    v.total_registros::bigint
  FROM euro_dash.vw_tabelas_atualizacao v
  ORDER BY v.table_name;
$$;

REVOKE ALL ON FUNCTION euro_dash.get_tabelas_atualizacao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION euro_dash.get_tabelas_atualizacao() TO anon, authenticated, service_role;
