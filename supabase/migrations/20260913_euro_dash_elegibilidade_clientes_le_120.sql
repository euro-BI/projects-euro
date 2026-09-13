-- Elegibilidade: média de clientes <= 120 permanece elegível; só > 120 derruba.
-- Ajusta v1 e v2 na mv_resumo_assessor.

DO $$
DECLARE
  def text;
  idx_defs text[];
  idx text;
  rec record;
  old_lt text := '< 120::numeric';
  new_le text := '<= 120::numeric';
  occurrences int;
BEGIN
  SELECT pg_get_viewdef('euro_dash.mv_resumo_assessor'::regclass, true) INTO def;

  SELECT count(*) INTO occurrences
  FROM regexp_matches(def, '< 120::numeric', 'g');

  IF occurrences = 0 THEN
    IF def LIKE '%<= 120::numeric%' THEN
      RAISE NOTICE 'euro_dash.mv_resumo_assessor already uses <= 120 for clientes';
      RETURN;
    END IF;
    RAISE EXCEPTION 'Failed to locate < 120::numeric in mv_resumo_assessor definition';
  END IF;

  def := replace(def, old_lt, new_le);

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
