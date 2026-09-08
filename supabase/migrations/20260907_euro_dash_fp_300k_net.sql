-- FP 300K+ na mv_resumo_assessor só conta conta com FP completo
-- E net atual > 300k no positivador do mesmo mês/assessor.
-- Antes o numerador vinha só de dados_fp.segmento_conta = 'PF 300K+'.

DO $$
DECLARE
  def text;
  idx_defs text[];
  idx text;
  rec record;
  old_cte text;
  new_cte text;
BEGIN
  SELECT pg_get_viewdef('euro_dash.mv_resumo_assessor'::regclass, true) INTO def;

  IF def LIKE '%btrim(pos.cliente) = btrim(fp.cod_conta)%' THEN
    RAISE NOTICE 'euro_dash.mv_resumo_assessor already filters FP by positivador net';
    RETURN;
  END IF;

  old_cte := $old$fp_300k AS (
         SELECT
                CASE
                    WHEN fp.cod_assessor ~~ 'A%'::text THEN fp.cod_assessor
                    ELSE 'A'::text || fp.cod_assessor
                END AS cod_assessor,
            date_trunc('month'::text, fp.periodo::timestamp with time zone) AS mes_ref,
            count(DISTINCT fp.cod_conta) AS total_fp_300k
           FROM euro_dash.dados_fp fp
          WHERE fp.completude = 100 AND fp.segmento_conta = 'PF 300K+'::text
          GROUP BY (
                CASE
                    WHEN fp.cod_assessor ~~ 'A%'::text THEN fp.cod_assessor
                    ELSE 'A'::text || fp.cod_assessor
                END), (date_trunc('month'::text, fp.periodo::timestamp with time zone))
        )$old$;

  new_cte := $new$fp_300k AS (
         SELECT
                CASE
                    WHEN fp.cod_assessor ~~ 'A%'::text THEN fp.cod_assessor
                    ELSE 'A'::text || fp.cod_assessor
                END AS cod_assessor,
            date_trunc('month'::text, fp.periodo::timestamp with time zone) AS mes_ref,
            count(DISTINCT fp.cod_conta) AS total_fp_300k
           FROM euro_dash.dados_fp fp
             JOIN euro_dash.dados_positivador pos ON pos.status = 'ATIVO'::text
              AND pos.tipo_pessoa = 'PESSOA FÍSICA'::text
              AND COALESCE(replace(pos.net_em_m, ','::text, '.'::text)::numeric, 0::numeric) > 300000::numeric
              AND date_trunc('month'::text, pos.data_posicao::timestamp with time zone) = date_trunc('month'::text, fp.periodo::timestamp with time zone)
              AND btrim(pos.cliente) = btrim(fp.cod_conta)
              AND
                CASE
                    WHEN pos.assessor ~~ 'A%'::text THEN pos.assessor
                    ELSE 'A'::text || pos.assessor
                END =
                CASE
                    WHEN fp.cod_assessor ~~ 'A%'::text THEN fp.cod_assessor
                    ELSE 'A'::text || fp.cod_assessor
                END
          WHERE fp.completude = 100 AND fp.segmento_conta = 'PF 300K+'::text
          GROUP BY (
                CASE
                    WHEN fp.cod_assessor ~~ 'A%'::text THEN fp.cod_assessor
                    ELSE 'A'::text || fp.cod_assessor
                END), (date_trunc('month'::text, fp.periodo::timestamp with time zone))
        )$new$;

  IF position(old_cte in def) = 0 THEN
    RAISE EXCEPTION 'Failed to locate fp_300k CTE in mv_resumo_assessor definition';
  END IF;

  def := replace(def, old_cte, new_cte);

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
