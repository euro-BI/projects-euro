-- Create euro_dash.vw_dra_receita_resumida from the public definition.
-- Source tables already exist in euro_dash; public objects stay untouched.

CREATE OR REPLACE VIEW euro_dash.vw_dra_receita_resumida AS
SELECT
  d.cod_interno,
  d.nome_agente AS assessor,
  COALESCE(m.receita, 'N/A'::text) AS receita,
  d.competencia,
  sum(COALESCE(NULLIF(replace(replace(d.escr_vl_comis, '.'::text, ''::text), ','::text, '.'::text), ''::text), '0'::text)::numeric) AS valor_comissao
FROM euro_dash.dados_dra_analitico d
LEFT JOIN euro_dash.dados_map_dra_receita m
  ON upper(TRIM(BOTH FROM d.familia_categoria)) = upper(TRIM(BOTH FROM m.familia_categoria))
GROUP BY d.cod_interno, d.nome_agente, (COALESCE(m.receita, 'N/A'::text)), d.competencia;

GRANT ALL ON TABLE euro_dash.vw_dra_receita_resumida TO anon, authenticated, service_role;
