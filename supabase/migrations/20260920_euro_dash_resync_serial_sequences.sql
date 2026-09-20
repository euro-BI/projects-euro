-- Sequences ficaram em public após mover tabelas para euro_dash;
-- last_value atrasado causa duplicate key no insert (ex.: dados_cambio_pkey / dados_fp_pkey).
DO $$
DECLARE
  r record;
  max_id bigint;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('euro_dash.dados_cambio', 'id', 'public.dados_cambio_id_seq'),
      ('euro_dash.dados_cetipados', 'id', 'public.dados_cetipados_id_seq'),
      ('euro_dash.dados_consorcio', 'id', 'public.dados_consorcio_id_seq'),
      ('euro_dash.dados_consorcios_adm', 'id', 'public.dados_consorcios_adm_id_seq'),
      ('euro_dash.dados_cotacoes_dolar', 'id', 'public.dados_cotacoes_dolar_id_seq'),
      ('euro_dash.dados_demonstrativo', 'id', 'public.dados_demonstrativo_id_seq'),
      ('euro_dash.dados_demonstrativo_full', 'id', 'public.dados_demonstrativo_full_id_seq'),
      ('euro_dash.dados_dra_analitico', 'id', 'public.dados_dra_analitico_id_seq'),
      ('euro_dash.dados_fp', 'id', 'public.dados_fp_id_seq'),
      ('euro_dash.dados_fundos', 'id', 'public.dados_fundos_id_seq'),
      ('euro_dash.dados_fundos_novo', 'id', 'public.dados_fundos_novo_id_seq'),
      ('euro_dash.dados_ofertas', 'id', 'public.dados_ofertas_id_seq'),
      ('euro_dash.dados_ofertas_ativas', 'id_oferta', 'public.dados_ofertas_ativas_id_oferta_seq'),
      ('euro_dash.dados_ofertas_faixa_fee', 'id_faixa', 'public.dados_ofertas_faixa_fee_id_faixa_seq'),
      ('euro_dash.dados_offshore_operacoes', 'id', 'public.dados_offshore_operacoes_id_seq'),
      ('euro_dash.dados_offshore_remessas', 'id', 'public.dados_offshore_remessas_id_seq'),
      ('euro_dash.dados_pj_custodia', 'id', 'public.dados_pj_custodia_id_seq'),
      ('euro_dash.dados_positivador', 'id', 'public.dados_positivador_id_seq'),
      ('euro_dash.dados_positivador_v2', 'id', 'public.dados_positivador_v2_id_seq'),
      ('euro_dash.dados_produtos_consorcio', 'id', 'public.dados_produtos_consorcio_id_seq'),
      ('euro_dash.dados_rf_fluxo', 'id', 'public.dados_rf_fluxo_id_seq'),
      ('euro_dash.dados_rv_executadas', 'id', 'public.dados_rv_executadas_id_seq'),
      ('euro_dash.dados_seguros_novo', 'id', 'public.dados_seguros_novo_id_seq'),
      ('euro_dash.dados_transferencias', 'id', 'public.dados_transferencias_id_seq'),
      ('euro_dash.facebook_ads_data', 'id', 'public.facebook_ads_data_id_seq'),
      ('euro_dash.metas_roa', 'id', 'public.metas_roa_id_seq')
    ) AS t(tbl, col, seq)
  LOOP
    IF to_regclass(r.seq) IS NULL THEN
      RAISE NOTICE 'sequence ausente: %', r.seq;
      CONTINUE;
    END IF;
    EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %s', r.col, r.tbl) INTO max_id;
    IF max_id > 0 THEN
      EXECUTE format('SELECT setval(%L, %s, true)', r.seq, max_id);
    ELSE
      EXECUTE format('SELECT setval(%L, 1, false)', r.seq);
    END IF;
    -- Sequences ficam em public; OWNED BY cross-schema não é permitido no Postgres.
  END LOOP;
END $$;
