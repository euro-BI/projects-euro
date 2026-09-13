-- NPS da elegibilidade S2: média simples dos scores mensais com resposta
-- (ex.: ago 67 + set 100 => 83.5). Meses sem resposta não entram na média.

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

  IF def LIKE '%avg(nps_mensal.score_mes)%' OR def LIKE '%avg(score_mes)%' THEN
    RAISE NOTICE 'euro_dash.mv_resumo_assessor already averages monthly NPS scores';
    RETURN;
  END IF;

  old_cte := $old$, nps_semestre AS (
         SELECT ct_1.cod_assessor,
            ct_1.data_posicao AS mes_ref,
            count(nps.nota_score) AS nps_respostas_semestre,
                CASE
                    WHEN count(nps.nota_score) > 0 THEN round((count(*) FILTER (WHERE nps.classificacao_nps = 'Promotor'::text) - count(*) FILTER (WHERE nps.classificacao_nps = 'Detrator'::text))::numeric / count(nps.nota_score)::numeric * 100::numeric)
                    ELSE NULL::numeric
                END AS nps_semestre
           FROM calculo_time ct_1
             LEFT JOIN euro_dash.vw_nps_tratado nps ON
                CASE
                    WHEN nps.assessor ~~ 'A%'::text THEN nps.assessor
                    ELSE 'A'::text || nps.assessor
                END = ct_1.cod_assessor AND nps.status = 'Finished'::text AND nps.nota_score IS NOT NULL AND nps.data_real >=
                CASE
                    WHEN EXTRACT(month FROM ct_1.data_posicao) <= 6::numeric THEN date_trunc('year'::text, ct_1.data_posicao::timestamp with time zone)::date
                    ELSE (date_trunc('year'::text, ct_1.data_posicao::timestamp with time zone) + '6 mons'::interval)::date
                END AND nps.data_real < (ct_1.data_posicao + '1 mon'::interval)::date
          GROUP BY ct_1.cod_assessor, ct_1.data_posicao
        )
$old$;

  new_cte := $new$, nps_mensal AS (
         SELECT ct_1.cod_assessor,
            ct_1.data_posicao AS mes_ref,
            date_trunc('month'::text, nps.data_real::timestamp with time zone)::date AS mes_nps,
            count(nps.nota_score) AS respostas_mes,
                CASE
                    WHEN count(nps.nota_score) > 0 THEN round((count(*) FILTER (WHERE nps.classificacao_nps = 'Promotor'::text) - count(*) FILTER (WHERE nps.classificacao_nps = 'Detrator'::text))::numeric / count(nps.nota_score)::numeric * 100::numeric)
                    ELSE NULL::numeric
                END AS score_mes
           FROM calculo_time ct_1
             LEFT JOIN euro_dash.vw_nps_tratado nps ON
                CASE
                    WHEN nps.assessor ~~ 'A%'::text THEN nps.assessor
                    ELSE 'A'::text || nps.assessor
                END = ct_1.cod_assessor AND nps.status = 'Finished'::text AND nps.nota_score IS NOT NULL AND nps.data_real >=
                CASE
                    WHEN EXTRACT(month FROM ct_1.data_posicao) <= 6::numeric THEN date_trunc('year'::text, ct_1.data_posicao::timestamp with time zone)::date
                    ELSE (date_trunc('year'::text, ct_1.data_posicao::timestamp with time zone) + '6 mons'::interval)::date
                END AND nps.data_real < (ct_1.data_posicao + '1 mon'::interval)::date
          GROUP BY ct_1.cod_assessor, ct_1.data_posicao, (date_trunc('month'::text, nps.data_real::timestamp with time zone))
        ), nps_semestre AS (
         SELECT nps_mensal.cod_assessor,
            nps_mensal.mes_ref,
            COALESCE(sum(nps_mensal.respostas_mes), 0::bigint) AS nps_respostas_semestre,
            round(avg(nps_mensal.score_mes) FILTER (WHERE nps_mensal.score_mes IS NOT NULL), 1) AS nps_semestre
           FROM nps_mensal
          GROUP BY nps_mensal.cod_assessor, nps_mensal.mes_ref
        )
$new$;

  IF position(old_cte in def) = 0 THEN
    RAISE EXCEPTION 'Failed to locate nps_semestre CTE in mv_resumo_assessor definition';
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
