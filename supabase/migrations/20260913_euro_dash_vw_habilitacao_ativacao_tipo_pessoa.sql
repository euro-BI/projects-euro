-- Lookup leve de tipo_pessoa por conta/cliente (último positivador).
-- Preferível a join por período: tipo_pessoa é atributo estável do cliente
-- e no recorte atual o match 1:1 com conta já é 100%.

CREATE INDEX IF NOT EXISTS dados_positivador_cliente_data_posicao_idx
  ON euro_dash.dados_positivador (cliente, data_posicao DESC);

CREATE OR REPLACE VIEW euro_dash.vw_habilitacao_ativacao AS
WITH cliente_tipo AS (
  SELECT DISTINCT ON (cliente)
    cliente,
    tipo_pessoa,
    data_posicao AS data_tipo_pessoa
  FROM euro_dash.dados_positivador
  WHERE cliente IS NOT NULL
  ORDER BY cliente, data_posicao DESC NULLS LAST
)
SELECT
  ha.id,
  ha.fonte,
  ha.conta,
  ha.cod_assessor,
  ha.data,
  ha.faixa,
  ha.conta_ativada,
  ha.created_at,
  ha.updated_at,
  ct.tipo_pessoa,
  ct.data_tipo_pessoa
FROM euro_dash.dados_habilitacao_ativacao ha
LEFT JOIN cliente_tipo ct ON ct.cliente = ha.conta;

COMMENT ON VIEW euro_dash.vw_habilitacao_ativacao IS
  'Habilitações/ativações enriquecidas com tipo_pessoa do último registro em dados_positivador (chave conta = cliente).';

GRANT SELECT ON euro_dash.vw_habilitacao_ativacao TO anon, authenticated, service_role;
