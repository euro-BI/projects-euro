-- RPC da aba Produtos RF: devolve só o snapshot mais recente até p_data_max.
-- LANGUAGE sql STABLE permite o planner usar o índice de data_posicao
-- (o rpc_get_diversificador_full em plpgsql materializa a view inteira).

CREATE OR REPLACE FUNCTION euro_dash.rpc_get_diversificador_rf(
  p_assessores text[] DEFAULT NULL,
  p_data_max date DEFAULT NULL
)
RETURNS TABLE(
  produto text,
  net text,
  data_posicao date,
  assessor text,
  cliente text,
  subproduto text,
  cnpj text,
  fator_risco text,
  ativo text,
  data_vencimento date
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    v.produto,
    v.net,
    v.data_posicao,
    v.assessor,
    v.cliente,
    v.subproduto,
    v.cnpj,
    v.fator_risco,
    v.ativo,
    v.data_vencimento
  FROM euro_dash.vw_diversificador_rf v
  WHERE (p_assessores IS NULL
         OR v.assessor = ANY (p_assessores)
         OR ('A' || v.assessor) = ANY (p_assessores))
    AND (p_data_max IS NULL OR v.data_posicao <= p_data_max)
    AND v.data_posicao = (
      SELECT MAX(v2.data_posicao)
      FROM euro_dash.vw_diversificador_rf v2
      WHERE (p_assessores IS NULL
             OR v2.assessor = ANY (p_assessores)
             OR ('A' || v2.assessor) = ANY (p_assessores))
        AND (p_data_max IS NULL OR v2.data_posicao <= p_data_max)
    )
$$;

GRANT EXECUTE ON FUNCTION euro_dash.rpc_get_diversificador_rf(text[], date)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
