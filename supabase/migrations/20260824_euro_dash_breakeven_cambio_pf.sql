ALTER TABLE public.dashboard_breakeven_targets
  DROP CONSTRAINT IF EXISTS dashboard_breakeven_targets_product_key_chk;

ALTER TABLE public.dashboard_breakeven_targets
  ADD CONSTRAINT dashboard_breakeven_targets_product_key_chk
  CHECK (product_key = ANY (ARRAY[
    'estruturadas'::text,
    'b3'::text,
    'rf'::text,
    'ofertas'::text,
    'cetipados'::text,
    'asset'::text,
    'offshore'::text,
    'previdencia'::text,
    'consorcios'::text,
    'seguros'::text,
    'compromissadas_pj'::text,
    'cambio'::text,
    'cambio_pf'::text
  ]));

ALTER TABLE euro_dash.dashboard_breakeven_targets
  DROP CONSTRAINT IF EXISTS dashboard_breakeven_targets_product_key_chk;

ALTER TABLE euro_dash.dashboard_breakeven_targets
  ADD CONSTRAINT dashboard_breakeven_targets_product_key_chk
  CHECK (product_key = ANY (ARRAY[
    'estruturadas'::text,
    'b3'::text,
    'rf'::text,
    'ofertas'::text,
    'cetipados'::text,
    'asset'::text,
    'offshore'::text,
    'previdencia'::text,
    'consorcios'::text,
    'seguros'::text,
    'compromissadas_pj'::text,
    'cambio'::text,
    'cambio_pf'::text
  ]));
