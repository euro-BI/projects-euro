-- Zera dados de public mantendo estrutura (tabelas/índices/constraints).
-- O app usa euro_dash; public fica só como esqueleto legado.

DO $$
DECLARE
  stmt text;
  r record;
BEGIN
  SELECT 'TRUNCATE TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ')
           || ' RESTART IDENTITY CASCADE'
    INTO stmt
  FROM pg_tables
  WHERE schemaname = 'public';

  IF stmt IS NULL THEN
    RAISE NOTICE 'Nenhuma tabela em public';
    RETURN;
  END IF;

  EXECUTE stmt;

  FOR r IN
    SELECT matviewname
    FROM pg_matviews
    WHERE schemaname = 'public'
    ORDER BY matviewname
  LOOP
    EXECUTE format('REFRESH MATERIALIZED VIEW public.%I', r.matviewname);
  END LOOP;
END $$;
