-- Padroniza cod_assessor em dados_captacoes para sempre usar prefixo A.
-- A ingestão já normaliza; o histórico antigo misturava 1607 e A1607.

UPDATE euro_dash.dados_captacoes
SET cod_assessor = 'A' || regexp_replace(btrim(cod_assessor), '[^0-9]', '', 'g')
WHERE cod_assessor IS NOT NULL
  AND btrim(cod_assessor) <> ''
  AND upper(btrim(cod_assessor)) NOT LIKE 'A%'
  AND regexp_replace(btrim(cod_assessor), '[^0-9]', '', 'g') <> '';
