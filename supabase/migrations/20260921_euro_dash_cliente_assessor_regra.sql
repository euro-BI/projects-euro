-- Regras persistentes de migração cliente → assessor (substitui hardcode do ingest-positivador).

CREATE TABLE IF NOT EXISTS euro_dash.cliente_assessor_regra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente text NOT NULL,
  assessor_destino text NOT NULL,
  assessor_origem text NULL,
  desde_data date NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  motivo text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cliente_assessor_regra_cliente_ativo_uidx
  ON euro_dash.cliente_assessor_regra (cliente)
  WHERE ativo;

CREATE INDEX IF NOT EXISTS cliente_assessor_regra_ativo_idx
  ON euro_dash.cliente_assessor_regra (ativo, desde_data);

ALTER TABLE euro_dash.cliente_assessor_regra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_all ON euro_dash.cliente_assessor_regra;
CREATE POLICY authenticated_all ON euro_dash.cliente_assessor_regra
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE euro_dash.cliente_assessor_regra TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION euro_dash.fn_norm_cliente(v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(v, ''), '\D', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION euro_dash.fn_norm_assessor_a(v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NULLIF(regexp_replace(upper(COALESCE(v, '')), '\D', '', 'g'), '') IS NULL THEN NULL
    ELSE 'A' || regexp_replace(upper(COALESCE(v, '')), '\D', '', 'g')
  END;
$$;

CREATE OR REPLACE FUNCTION euro_dash.fn_norm_assessor_digits(v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(upper(COALESCE(v, '')), '\D', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION euro_dash.fn_assessor_match(col text, origem_a text, origem_d text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    origem_a IS NULL
    OR euro_dash.fn_norm_assessor_a(col) = origem_a
    OR euro_dash.fn_norm_assessor_digits(col) = origem_d;
$$;

CREATE OR REPLACE FUNCTION euro_dash.preview_cliente_assessor_regra(
  p_clientes text[],
  p_destino text,
  p_desde date,
  p_origem text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = euro_dash, public
AS $$
DECLARE
  clientes text[];
  dest_a text;
  dest_d text;
  orig_a text;
  orig_d text;
  result jsonb := '{}'::jsonb;
  n bigint;
BEGIN
  SELECT ARRAY(
    SELECT DISTINCT euro_dash.fn_norm_cliente(c)
    FROM unnest(COALESCE(p_clientes, ARRAY[]::text[])) AS c
    WHERE euro_dash.fn_norm_cliente(c) IS NOT NULL
  ) INTO clientes;

  IF clientes IS NULL OR cardinality(clientes) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um cliente';
  END IF;

  dest_a := euro_dash.fn_norm_assessor_a(p_destino);
  dest_d := euro_dash.fn_norm_assessor_digits(p_destino);
  IF dest_a IS NULL THEN
    RAISE EXCEPTION 'Assessor destino inválido';
  END IF;

  orig_a := euro_dash.fn_norm_assessor_a(p_origem);
  orig_d := euro_dash.fn_norm_assessor_digits(p_origem);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_positivador t
  WHERE euro_dash.fn_norm_cliente(t.cliente) = ANY (clientes)
    AND t.data_posicao >= p_desde
    AND euro_dash.fn_assessor_match(t.assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_digits(t.assessor) IS DISTINCT FROM dest_d;
  result := result || jsonb_build_object('dados_positivador', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_captacoes t
  WHERE euro_dash.fn_norm_cliente(t.cod_cliente) = ANY (clientes)
    AND t.data_captacao >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_captacoes', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_transferencias t
  WHERE euro_dash.fn_norm_cliente(t.cod_cliente) = ANY (clientes)
    AND COALESCE(t.data_transferencia, t.data_solicitacao) >= p_desde
    AND (
      euro_dash.fn_assessor_match(t.cod_assessor_origem, orig_a, orig_d)
      OR euro_dash.fn_assessor_match(t.cod_assessor_destino, orig_a, orig_d)
    )
    AND (
      euro_dash.fn_norm_assessor_a(t.cod_assessor_origem) IS DISTINCT FROM dest_a
      OR euro_dash.fn_norm_assessor_a(t.cod_assessor_destino) IS DISTINCT FROM dest_a
    );
  result := result || jsonb_build_object('dados_transferencias', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_demonstrativo t
  WHERE euro_dash.fn_norm_cliente(t.cod_cliente) = ANY (clientes)
    AND t.data >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor_direto, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor_direto) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_demonstrativo', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_demonstrativo_full t
  WHERE euro_dash.fn_norm_cliente(t.cod_cliente) = ANY (clientes)
    AND t.data >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor_direto, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor_direto) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_demonstrativo_full', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_cetipados t
  WHERE euro_dash.fn_norm_cliente(t.cliente) = ANY (clientes)
    AND t.data >= p_desde
    AND euro_dash.fn_assessor_match(t.assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_cetipados', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_rf_fluxo t
  WHERE euro_dash.fn_norm_cliente(t.cod_conta) = ANY (clientes)
    AND t.data >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_rf_fluxo', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_rv_executadas t
  WHERE euro_dash.fn_norm_cliente(t.codigo_cliente) = ANY (clientes)
    AND t.data_inclusao >= p_desde
    AND (
      euro_dash.fn_assessor_match(t.assessor_do_cliente, orig_a, orig_d)
      OR euro_dash.fn_assessor_match(t.assessor_da_operacao, orig_a, orig_d)
    )
    AND (
      euro_dash.fn_norm_assessor_a(t.assessor_do_cliente) IS DISTINCT FROM dest_a
      OR euro_dash.fn_norm_assessor_a(t.assessor_da_operacao) IS DISTINCT FROM dest_a
    );
  result := result || jsonb_build_object('dados_rv_executadas', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_pj_custodia t
  WHERE euro_dash.fn_norm_cliente(t.cod_conta) = ANY (clientes)
    AND t.data_foto_custodia >= p_desde
    AND euro_dash.fn_assessor_match(t.codigo_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.codigo_assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_pj_custodia', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_posicao_black t
  WHERE euro_dash.fn_norm_cliente(t.codigo_cliente) = ANY (clientes)
    AND t.data_registro >= p_desde
    AND euro_dash.fn_assessor_match(t.codigo_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.codigo_assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_posicao_black', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_offshore_operacoes t
  WHERE euro_dash.fn_norm_cliente(t.cod_conta_brasil) = ANY (clientes)
    AND COALESCE(t.data_abertura_conta, p_desde) >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_offshore_operacoes', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_fp t
  WHERE euro_dash.fn_norm_cliente(t.cod_conta) = ANY (clientes)
    AND t.periodo >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_fp', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_habilitacao_ativacao t
  WHERE euro_dash.fn_norm_cliente(t.conta) = ANY (clientes)
    AND t.data >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_habilitacao_ativacao', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_nps t
  WHERE euro_dash.fn_norm_cliente(t.conta) = ANY (clientes)
    AND COALESCE(t.data_resposta, t.data_envio) >= p_desde
    AND euro_dash.fn_assessor_match(t.assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_nps', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_fundos_novo t
  WHERE euro_dash.fn_norm_cliente(t.cliente) = ANY (clientes)
    AND t.data_liquidacao >= p_desde
    AND euro_dash.fn_assessor_match(t.assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_fundos_novo', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_diversificador t
  WHERE euro_dash.fn_norm_cliente(t.cliente) = ANY (clientes)
    AND t.data >= p_desde
    AND euro_dash.fn_assessor_match(t.assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_diversificador', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_diversificador_full t
  WHERE euro_dash.fn_norm_cliente(t.cliente) = ANY (clientes)
    AND t.data_posicao >= p_desde
    AND euro_dash.fn_assessor_match(t.assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_diversificador_full', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_rupturas t
  WHERE euro_dash.fn_norm_cliente(t.cod_cliente) = ANY (clientes)
    AND t.periodo >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_rupturas', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_seguros_novo t
  WHERE euro_dash.fn_norm_cliente(t.conta) = ANY (clientes)
    AND t.data_inicial >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_seguros_novo', n);

  SELECT COUNT(*) INTO n FROM euro_dash.dados_consorcio t
  WHERE euro_dash.fn_norm_cliente(t.codigo_cliente) = ANY (clientes)
    AND t.data_venda >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  result := result || jsonb_build_object('dados_consorcio', n);

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION euro_dash.aplicar_cliente_assessor_regra(
  p_clientes text[],
  p_destino text,
  p_desde date,
  p_origem text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = euro_dash, public
AS $$
DECLARE
  clientes text[];
  dest_a text;
  dest_d text;
  orig_a text;
  orig_d text;
  result jsonb := '{}'::jsonb;
  n bigint;
BEGIN
  SELECT ARRAY(
    SELECT DISTINCT euro_dash.fn_norm_cliente(c)
    FROM unnest(COALESCE(p_clientes, ARRAY[]::text[])) AS c
    WHERE euro_dash.fn_norm_cliente(c) IS NOT NULL
  ) INTO clientes;

  IF clientes IS NULL OR cardinality(clientes) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um cliente';
  END IF;

  dest_a := euro_dash.fn_norm_assessor_a(p_destino);
  dest_d := euro_dash.fn_norm_assessor_digits(p_destino);
  IF dest_a IS NULL THEN
    RAISE EXCEPTION 'Assessor destino inválido';
  END IF;

  orig_a := euro_dash.fn_norm_assessor_a(p_origem);
  orig_d := euro_dash.fn_norm_assessor_digits(p_origem);

  UPDATE euro_dash.dados_positivador t
  SET assessor = dest_d
  WHERE euro_dash.fn_norm_cliente(t.cliente) = ANY (clientes)
    AND t.data_posicao >= p_desde
    AND euro_dash.fn_assessor_match(t.assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_digits(t.assessor) IS DISTINCT FROM dest_d;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_positivador', n);

  UPDATE euro_dash.dados_captacoes t
  SET cod_assessor = dest_a
  WHERE euro_dash.fn_norm_cliente(t.cod_cliente) = ANY (clientes)
    AND t.data_captacao >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_captacoes', n);

  UPDATE euro_dash.dados_transferencias t
  SET
    cod_assessor_origem = CASE
      WHEN euro_dash.fn_assessor_match(t.cod_assessor_origem, orig_a, orig_d) THEN dest_a
      ELSE t.cod_assessor_origem
    END,
    cod_assessor_destino = CASE
      WHEN euro_dash.fn_assessor_match(t.cod_assessor_destino, orig_a, orig_d) THEN dest_a
      ELSE t.cod_assessor_destino
    END
  WHERE euro_dash.fn_norm_cliente(t.cod_cliente) = ANY (clientes)
    AND COALESCE(t.data_transferencia, t.data_solicitacao) >= p_desde
    AND (
      euro_dash.fn_assessor_match(t.cod_assessor_origem, orig_a, orig_d)
      OR euro_dash.fn_assessor_match(t.cod_assessor_destino, orig_a, orig_d)
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_transferencias', n);

  UPDATE euro_dash.dados_demonstrativo t
  SET cod_assessor_direto = dest_a
  WHERE euro_dash.fn_norm_cliente(t.cod_cliente) = ANY (clientes)
    AND t.data >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor_direto, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor_direto) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_demonstrativo', n);

  UPDATE euro_dash.dados_demonstrativo_full t
  SET cod_assessor_direto = dest_a
  WHERE euro_dash.fn_norm_cliente(t.cod_cliente) = ANY (clientes)
    AND t.data >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor_direto, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor_direto) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_demonstrativo_full', n);

  UPDATE euro_dash.dados_cetipados t
  SET assessor = dest_a
  WHERE euro_dash.fn_norm_cliente(t.cliente) = ANY (clientes)
    AND t.data >= p_desde
    AND euro_dash.fn_assessor_match(t.assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_cetipados', n);

  UPDATE euro_dash.dados_rf_fluxo t
  SET cod_assessor = dest_a
  WHERE euro_dash.fn_norm_cliente(t.cod_conta) = ANY (clientes)
    AND t.data >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_rf_fluxo', n);

  UPDATE euro_dash.dados_rv_executadas t
  SET
    assessor_do_cliente = CASE
      WHEN euro_dash.fn_assessor_match(t.assessor_do_cliente, orig_a, orig_d) THEN dest_a
      ELSE t.assessor_do_cliente
    END,
    assessor_da_operacao = CASE
      WHEN euro_dash.fn_assessor_match(t.assessor_da_operacao, orig_a, orig_d) THEN dest_a
      ELSE t.assessor_da_operacao
    END
  WHERE euro_dash.fn_norm_cliente(t.codigo_cliente) = ANY (clientes)
    AND t.data_inclusao >= p_desde
    AND (
      euro_dash.fn_assessor_match(t.assessor_do_cliente, orig_a, orig_d)
      OR euro_dash.fn_assessor_match(t.assessor_da_operacao, orig_a, orig_d)
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_rv_executadas', n);

  UPDATE euro_dash.dados_pj_custodia t
  SET codigo_assessor = dest_a
  WHERE euro_dash.fn_norm_cliente(t.cod_conta) = ANY (clientes)
    AND t.data_foto_custodia >= p_desde
    AND euro_dash.fn_assessor_match(t.codigo_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.codigo_assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_pj_custodia', n);

  UPDATE euro_dash.dados_posicao_black t
  SET codigo_assessor = dest_a
  WHERE euro_dash.fn_norm_cliente(t.codigo_cliente) = ANY (clientes)
    AND t.data_registro >= p_desde
    AND euro_dash.fn_assessor_match(t.codigo_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.codigo_assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_posicao_black', n);

  UPDATE euro_dash.dados_offshore_operacoes t
  SET cod_assessor = dest_a
  WHERE euro_dash.fn_norm_cliente(t.cod_conta_brasil) = ANY (clientes)
    AND COALESCE(t.data_abertura_conta, p_desde) >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_offshore_operacoes', n);

  UPDATE euro_dash.dados_fp t
  SET cod_assessor = dest_a
  WHERE euro_dash.fn_norm_cliente(t.cod_conta) = ANY (clientes)
    AND t.periodo >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_fp', n);

  UPDATE euro_dash.dados_habilitacao_ativacao t
  SET cod_assessor = dest_a
  WHERE euro_dash.fn_norm_cliente(t.conta) = ANY (clientes)
    AND t.data >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_habilitacao_ativacao', n);

  UPDATE euro_dash.dados_nps t
  SET assessor = dest_a
  WHERE euro_dash.fn_norm_cliente(t.conta) = ANY (clientes)
    AND COALESCE(t.data_resposta, t.data_envio) >= p_desde
    AND euro_dash.fn_assessor_match(t.assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_nps', n);

  UPDATE euro_dash.dados_fundos_novo t
  SET assessor = dest_a
  WHERE euro_dash.fn_norm_cliente(t.cliente) = ANY (clientes)
    AND t.data_liquidacao >= p_desde
    AND euro_dash.fn_assessor_match(t.assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_fundos_novo', n);

  UPDATE euro_dash.dados_diversificador t
  SET assessor = dest_a
  WHERE euro_dash.fn_norm_cliente(t.cliente) = ANY (clientes)
    AND t.data >= p_desde
    AND euro_dash.fn_assessor_match(t.assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_diversificador', n);

  UPDATE euro_dash.dados_diversificador_full t
  SET assessor = dest_a
  WHERE euro_dash.fn_norm_cliente(t.cliente) = ANY (clientes)
    AND t.data_posicao >= p_desde
    AND euro_dash.fn_assessor_match(t.assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_diversificador_full', n);

  UPDATE euro_dash.dados_rupturas t
  SET cod_assessor = dest_a
  WHERE euro_dash.fn_norm_cliente(t.cod_cliente) = ANY (clientes)
    AND t.periodo >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_rupturas', n);

  UPDATE euro_dash.dados_seguros_novo t
  SET cod_assessor = dest_a
  WHERE euro_dash.fn_norm_cliente(t.conta) = ANY (clientes)
    AND t.data_inicial >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_seguros_novo', n);

  UPDATE euro_dash.dados_consorcio t
  SET cod_assessor = dest_a, updated_at = now()
  WHERE euro_dash.fn_norm_cliente(t.codigo_cliente) = ANY (clientes)
    AND t.data_venda >= p_desde
    AND euro_dash.fn_assessor_match(t.cod_assessor, orig_a, orig_d)
    AND euro_dash.fn_norm_assessor_a(t.cod_assessor) IS DISTINCT FROM dest_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  result := result || jsonb_build_object('dados_consorcio', n);

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION euro_dash.reaplicar_cliente_assessor_regras_ativas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = euro_dash, public
AS $$
DECLARE
  r record;
  part jsonb;
  total jsonb := '{}'::jsonb;
  k text;
BEGIN
  FOR r IN
    SELECT cliente, assessor_destino, assessor_origem, desde_data
    FROM euro_dash.cliente_assessor_regra
    WHERE ativo
  LOOP
    part := euro_dash.aplicar_cliente_assessor_regra(
      ARRAY[r.cliente],
      r.assessor_destino,
      r.desde_data,
      r.assessor_origem
    );
    FOR k IN SELECT jsonb_object_keys(part)
    LOOP
      total := jsonb_set(
        total,
        ARRAY[k],
        to_jsonb(COALESCE((total ->> k)::bigint, 0) + COALESCE((part ->> k)::bigint, 0))
      );
    END LOOP;
  END LOOP;
  RETURN total;
END;
$$;

GRANT EXECUTE ON FUNCTION euro_dash.preview_cliente_assessor_regra(text[], text, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION euro_dash.aplicar_cliente_assessor_regra(text[], text, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION euro_dash.reaplicar_cliente_assessor_regras_ativas() TO authenticated, service_role;

-- Seed do hardcode legado (positivador → 11111 desde 2026-02-01)
INSERT INTO euro_dash.cliente_assessor_regra (cliente, assessor_destino, desde_data, ativo, motivo)
SELECT c, 'A11111', '2026-02-01'::date, true, 'legado ingest-positivador'
FROM unnest(ARRAY[
  '2027196','59745','566688','322517','371085','333786','416490','334618','11377756','7845094',
  '3986673','18993165','8925931','18320228','3290256','2452604','384345','2612319','2335724','2135974',
  '4691282','50539','2031993','6085999','4397795','22122','15422445','2162204','2999982','11368017',
  '3240761','2233629','333095','583780','2203938','4769320','9613295','2197784','91474','4341205',
  '4270022','2244558','5175938','2082397','64715','5245530','7222328','9840182','12197862','2751183',
  '481744','4949366','590633','5583966','2592427','15111807','331190','2262981','2254896'
]::text[]) AS c
WHERE NOT EXISTS (
  SELECT 1 FROM euro_dash.cliente_assessor_regra r
  WHERE r.cliente = c AND r.ativo
);
