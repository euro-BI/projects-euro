-- Bifurca elegibilidade do Super Ranking na mv_resumo_assessor:
-- v1 (até 2026-06): clientes < 120 + FP > 50% + rupturas <= 5
-- v2 (a partir de 2026-07): clientes < 120 + média Servir semestre >= 60 + NPS semestre >= 80
--   (NPS sem respostas no semestre não derruba)

DO $$
DECLARE
  def text;
  idx_defs text[];
  idx text;
  rec record;
  old_bridge text;
  new_bridge text;
  old_tail text;
  new_tail text;
BEGIN
  SELECT pg_get_viewdef('euro_dash.mv_resumo_assessor'::regclass, true) INTO def;

  IF def LIKE '%media_servir_semestre%' THEN
    RAISE NOTICE 'euro_dash.mv_resumo_assessor already has S2 eligibility rules';
    RETURN;
  END IF;

  old_bridge :=
$old_bridge$
           FROM calculo_final
        )
 SELECT cod_assessor,
$old_bridge$;

  new_bridge :=
$new_bridge$
           FROM calculo_final
        ), servir_semestre AS (
         SELECT
            ct.cod_assessor,
            ct.data_posicao AS mes_ref,
            round(avg(dms.indice_modelo_servir), 2) AS media_servir_semestre
           FROM calculo_time ct
             LEFT JOIN euro_dash.dados_modelo_servir dms ON
                CASE
                    WHEN dms.cod_assessor ~~ 'A%'::text THEN dms.cod_assessor
                    ELSE 'A'::text || dms.cod_assessor
                END = ct.cod_assessor
              AND dms.periodo <= ct.data_posicao
              AND date_trunc('year'::text, dms.periodo::timestamp with time zone) = date_trunc('year'::text, ct.data_posicao::timestamp with time zone)
              AND (
                EXTRACT(month FROM ct.data_posicao) <= 6::numeric AND EXTRACT(month FROM dms.periodo) <= 6::numeric
                OR
                EXTRACT(month FROM ct.data_posicao) > 6::numeric AND EXTRACT(month FROM dms.periodo) > 6::numeric
              )
          GROUP BY ct.cod_assessor, ct.data_posicao
        ), nps_semestre AS (
         SELECT
            ct.cod_assessor,
            ct.data_posicao AS mes_ref,
            count(nps.nota_score) AS nps_respostas_semestre,
                CASE
                    WHEN count(nps.nota_score) > 0 THEN round((
                        count(*) FILTER (WHERE nps.classificacao_nps = 'Promotor'::text)
                        - count(*) FILTER (WHERE nps.classificacao_nps = 'Detrator'::text)
                    )::numeric / count(nps.nota_score)::numeric * 100::numeric)
                    ELSE NULL::numeric
                END AS nps_semestre
           FROM calculo_time ct
             LEFT JOIN euro_dash.vw_nps_tratado nps ON
                CASE
                    WHEN nps.assessor ~~ 'A%'::text THEN nps.assessor
                    ELSE 'A'::text || nps.assessor
                END = ct.cod_assessor
              AND nps.status = 'Finished'::text
              AND nps.nota_score IS NOT NULL
              AND nps.data_real >=
                CASE
                    WHEN EXTRACT(month FROM ct.data_posicao) <= 6::numeric THEN date_trunc('year'::text, ct.data_posicao::timestamp with time zone)::date
                    ELSE (date_trunc('year'::text, ct.data_posicao::timestamp with time zone) + '6 mons'::interval)::date
                END
              AND nps.data_real < (ct.data_posicao + '1 mon'::interval)::date
          GROUP BY ct.cod_assessor, ct.data_posicao
        )
 SELECT ct.cod_assessor,
$new_bridge$;

  -- Dollar-quoted blocks above include a leading newline; trim to match pg_get_viewdef.
  old_bridge := substr(old_bridge, 2);
  new_bridge := substr(new_bridge, 2);

  IF position(old_bridge in def) = 0 THEN
    RAISE EXCEPTION 'Failed to locate calculo_time bridge in mv_resumo_assessor definition';
  END IF;

  def := replace(def, old_bridge, new_bridge);

  old_tail :=
$old_tail$
    round(avg(total_clientes) OVER (PARTITION BY cod_assessor ORDER BY data_posicao ROWS BETWEEN 5 PRECEDING AND CURRENT ROW), 2) AS media_movel_clientes_6m,
    round(avg(total_clientes_ruptura) OVER (PARTITION BY cod_assessor ORDER BY data_posicao ROWS BETWEEN 5 PRECEDING AND CURRENT ROW), 2) AS media_movel_rupturas_6m,
        CASE
            WHEN round(avg(total_clientes) OVER (PARTITION BY cod_assessor ORDER BY data_posicao ROWS BETWEEN 5 PRECEDING AND CURRENT ROW), 2) < 120::numeric AND (total_fp_300k::numeric / NULLIF(meta_fp300k, 0)::numeric) > 0.5 AND round(avg(total_clientes_ruptura) OVER (PARTITION BY cod_assessor ORDER BY data_posicao ROWS BETWEEN 5 PRECEDING AND CURRENT ROW), 2) <= 5::numeric THEN true
            ELSE false
        END AS elegibilidade,
    sum(pontos_total + pontos_lider_roa + pontos_lider_cap) OVER (PARTITION BY cod_assessor, (date_trunc('year'::text, data_posicao::timestamp with time zone)) ORDER BY data_posicao) AS pontos_totais_acumulado
   FROM calculo_time
  ORDER BY data_posicao DESC;
$old_tail$;

  new_tail :=
$new_tail$
    round(avg(ct.total_clientes) OVER (PARTITION BY ct.cod_assessor ORDER BY ct.data_posicao ROWS BETWEEN 5 PRECEDING AND CURRENT ROW), 2) AS media_movel_clientes_6m,
    round(avg(ct.total_clientes_ruptura) OVER (PARTITION BY ct.cod_assessor ORDER BY ct.data_posicao ROWS BETWEEN 5 PRECEDING AND CURRENT ROW), 2) AS media_movel_rupturas_6m,
    ss.media_servir_semestre,
    ns.nps_semestre,
    COALESCE(ns.nps_respostas_semestre, 0::bigint) AS nps_respostas_semestre,
        CASE
            WHEN ct.data_posicao < '2026-07-01'::date THEN
                CASE
                    WHEN round(avg(ct.total_clientes) OVER (PARTITION BY ct.cod_assessor ORDER BY ct.data_posicao ROWS BETWEEN 5 PRECEDING AND CURRENT ROW), 2) < 120::numeric
                     AND (ct.total_fp_300k::numeric / NULLIF(ct.meta_fp300k, 0)::numeric) > 0.5
                     AND round(avg(ct.total_clientes_ruptura) OVER (PARTITION BY ct.cod_assessor ORDER BY ct.data_posicao ROWS BETWEEN 5 PRECEDING AND CURRENT ROW), 2) <= 5::numeric
                    THEN true
                    ELSE false
                END
            ELSE
                CASE
                    WHEN round(avg(ct.total_clientes) OVER (PARTITION BY ct.cod_assessor ORDER BY ct.data_posicao ROWS BETWEEN 5 PRECEDING AND CURRENT ROW), 2) < 120::numeric
                     AND ss.media_servir_semestre >= 60::numeric
                     AND (COALESCE(ns.nps_respostas_semestre, 0::bigint) = 0 OR ns.nps_semestre >= 80::numeric)
                    THEN true
                    ELSE false
                END
        END AS elegibilidade,
    sum(ct.pontos_total + ct.pontos_lider_roa + ct.pontos_lider_cap) OVER (PARTITION BY ct.cod_assessor, (date_trunc('year'::text, ct.data_posicao::timestamp with time zone)) ORDER BY ct.data_posicao) AS pontos_totais_acumulado
   FROM calculo_time ct
     LEFT JOIN servir_semestre ss ON ss.cod_assessor = ct.cod_assessor AND ss.mes_ref = ct.data_posicao
     LEFT JOIN nps_semestre ns ON ns.cod_assessor = ct.cod_assessor AND ns.mes_ref = ct.data_posicao
  ORDER BY ct.data_posicao DESC;
$new_tail$;

  old_tail := substr(old_tail, 2);
  new_tail := substr(new_tail, 2);
  -- Drop trailing newline introduced by dollar-quote closing line.
  IF right(old_tail, 1) = E'\n' THEN old_tail := left(old_tail, length(old_tail) - 1); END IF;
  IF right(new_tail, 1) = E'\n' THEN new_tail := left(new_tail, length(new_tail) - 1); END IF;

  IF position(old_tail in def) = 0 THEN
    RAISE EXCEPTION 'Failed to locate elegibilidade tail in mv_resumo_assessor definition';
  END IF;

  def := replace(def, old_tail, new_tail);

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
