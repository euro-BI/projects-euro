-- Rebind every euro_dash view/matview that still reads public objects.
-- public schema objects are left untouched.

DO $$
DECLARE
  r record;
  def text;
  idx_defs text[];
  idx text;
BEGIN
  FOR r IN
    SELECT DISTINCT dep.oid, dep.relname
    FROM pg_class dep
    JOIN pg_namespace dep_ns ON dep_ns.oid = dep.relnamespace
    JOIN pg_rewrite rw ON rw.ev_class = dep.oid
    JOIN pg_depend d ON d.objid = rw.oid
    JOIN pg_class src ON src.oid = d.refobjid
    JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
    WHERE dep_ns.nspname = 'euro_dash'
      AND dep.relkind = 'v'
      AND src.oid <> dep.oid
      AND src.relkind IN ('r', 'v', 'm', 'f', 'p')
      AND src_ns.nspname = 'public'
    ORDER BY dep.relname
  LOOP
    SELECT pg_get_viewdef(r.oid, true) INTO def;
    def := replace(def, 'public.', 'euro_dash.');
    PERFORM set_config('search_path', 'euro_dash, pg_temp', true);
    EXECUTE format('CREATE OR REPLACE VIEW euro_dash.%I AS %s', r.relname, def);
    PERFORM set_config('search_path', 'public, euro_dash, pg_catalog', true);
  END LOOP;

  FOR r IN
    SELECT DISTINCT dep.oid, dep.relname
    FROM pg_class dep
    JOIN pg_namespace dep_ns ON dep_ns.oid = dep.relnamespace
    JOIN pg_rewrite rw ON rw.ev_class = dep.oid
    JOIN pg_depend d ON d.objid = rw.oid
    JOIN pg_class src ON src.oid = d.refobjid
    JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
    WHERE dep_ns.nspname = 'euro_dash'
      AND dep.relkind = 'm'
      AND src.oid <> dep.oid
      AND src.relkind IN ('r', 'v', 'm', 'f', 'p')
      AND src_ns.nspname = 'public'
    ORDER BY dep.relname
  LOOP
    SELECT pg_get_viewdef(r.oid, true) INTO def;
    def := replace(def, 'public.', 'euro_dash.');

    SELECT coalesce(array_agg(indexdef), '{}')
      INTO idx_defs
    FROM pg_indexes
    WHERE schemaname = 'euro_dash'
      AND tablename = r.relname;

    EXECUTE format('DROP MATERIALIZED VIEW euro_dash.%I', r.relname);

    PERFORM set_config('search_path', 'euro_dash, pg_temp', true);
    EXECUTE format('CREATE MATERIALIZED VIEW euro_dash.%I AS %s', r.relname, def);
    PERFORM set_config('search_path', 'public, euro_dash, pg_catalog', true);

    FOREACH idx IN ARRAY idx_defs LOOP
      EXECUTE idx;
    END LOOP;

    EXECUTE format('GRANT SELECT ON TABLE euro_dash.%I TO anon, authenticated', r.relname);
    EXECUTE format('GRANT ALL ON TABLE euro_dash.%I TO service_role', r.relname);
  END LOOP;
END $$;
