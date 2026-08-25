-- Add receita_cambio_pf / receita_cambio_pj to euro_dash.mv_resumo_assessor.
-- receita_cambio stays as PF + PJ total. public MV is left untouched.

DO $$
DECLARE
  def text;
  idx_defs text[];
  idx text;
  rec record;
BEGIN
  SELECT pg_get_viewdef('euro_dash.mv_resumo_assessor'::regclass, true) INTO def;

  IF def LIKE '%receita_cambio_pf%' THEN
    RAISE NOTICE 'euro_dash.mv_resumo_assessor already has receita_cambio_pf';
    RETURN;
  END IF;

  CREATE TEMP TABLE _mv_dep_views (
    schema_name text,
    view_name text,
    def text
  ) ON COMMIT DROP;

  INSERT INTO _mv_dep_views (schema_name, view_name, def)
  SELECT DISTINCT dep_ns.nspname, dep.relname, pg_get_viewdef(dep.oid, true)
  FROM pg_depend d
  JOIN pg_rewrite r ON r.oid = d.objid
  JOIN pg_class dep ON dep.oid = r.ev_class
  JOIN pg_namespace dep_ns ON dep_ns.oid = dep.relnamespace
  JOIN pg_class src ON src.oid = d.refobjid
  JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
  WHERE src_ns.nspname = 'euro_dash'
    AND src.relname = 'mv_resumo_assessor'
    AND dep.relkind = 'v'
    AND dep.oid <> src.oid;

  SELECT coalesce(array_agg(indexdef), '{}')
    INTO idx_defs
  FROM pg_indexes
  WHERE schemaname = 'euro_dash'
    AND tablename = 'mv_resumo_assessor';

  def := replace(
    def,
    'sum(COALESCE(NULLIF(replace(dados_cambio.receita_a_dividir, '',''::text, ''.''::text)::numeric, 0::numeric), 0::numeric) / 2::numeric) AS receita_cambio',
    'sum(COALESCE(NULLIF(replace(dados_cambio.receita_a_dividir, '',''::text, ''.''::text)::numeric, 0::numeric), 0::numeric) / 2::numeric) AS receita_cambio,
            sum(COALESCE(NULLIF(replace(dados_cambio.receita_a_dividir, '',''::text, ''.''::text)::numeric, 0::numeric), 0::numeric) / 2::numeric) FILTER (WHERE upper(btrim(COALESCE(dados_cambio.tp_pessoa, ''''::text))) = ''PF''::text) AS receita_cambio_pf,
            sum(COALESCE(NULLIF(replace(dados_cambio.receita_a_dividir, '',''::text, ''.''::text)::numeric, 0::numeric), 0::numeric) / 2::numeric) FILTER (WHERE upper(btrim(COALESCE(dados_cambio.tp_pessoa, ''''::text))) = ''PJ''::text) AS receita_cambio_pj'
  );

  def := replace(
    def,
    'round(COALESCE(rca.receita_cambio, 0::numeric), 2) AS receita_cambio,
            round(COALESCE(rco.receita_compromissadas, 0::numeric), 2) AS receita_compromissadas',
    'round(COALESCE(rca.receita_cambio, 0::numeric), 2) AS receita_cambio,
            round(COALESCE(rca.receita_cambio_pf, 0::numeric), 2) AS receita_cambio_pf,
            round(COALESCE(rca.receita_cambio_pj, 0::numeric), 2) AS receita_cambio_pj,
            round(COALESCE(rco.receita_compromissadas, 0::numeric), 2) AS receita_compromissadas'
  );

  def := replace(
    def,
    'rca.receita_cambio, rco.receita_compromissadas',
    'rca.receita_cambio, rca.receita_cambio_pf, rca.receita_cambio_pj, rco.receita_compromissadas'
  );

  def := replace(
    def,
    'calculo_final.receita_consorcios,
            calculo_final.receita_cambio,
            calculo_final.receita_compromissadas',
    'calculo_final.receita_consorcios,
            calculo_final.receita_cambio,
            calculo_final.receita_cambio_pf,
            calculo_final.receita_cambio_pj,
            calculo_final.receita_compromissadas'
  );

  def := replace(
    def,
    '    receita_consorcios,
    receita_cambio,
    receita_compromissadas,',
    '    receita_consorcios,
    receita_cambio,
    receita_cambio_pf,
    receita_cambio_pj,
    receita_compromissadas,'
  );

  IF position('receita_cambio_pf' in def) = 0 THEN
    RAISE EXCEPTION 'Failed to inject receita_cambio_pf into mv definition';
  END IF;

  DROP MATERIALIZED VIEW euro_dash.mv_resumo_assessor CASCADE;

  PERFORM set_config('search_path', 'euro_dash, pg_temp', true);
  EXECUTE 'CREATE MATERIALIZED VIEW euro_dash.mv_resumo_assessor AS ' || def;
  PERFORM set_config('search_path', 'euro_dash, public, pg_catalog', true);

  FOREACH idx IN ARRAY idx_defs LOOP
    EXECUTE idx;
  END LOOP;

  FOR rec IN SELECT * FROM _mv_dep_views LOOP
    EXECUTE format('CREATE VIEW %I.%I AS %s', rec.schema_name, rec.view_name, rec.def);
    EXECUTE format('GRANT ALL ON TABLE %I.%I TO anon, authenticated, service_role', rec.schema_name, rec.view_name);
  END LOOP;

  EXECUTE 'GRANT ALL ON TABLE euro_dash.mv_resumo_assessor TO anon, authenticated, service_role';
END $$;
