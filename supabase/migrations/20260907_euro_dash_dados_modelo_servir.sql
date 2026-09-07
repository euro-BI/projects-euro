-- Índice do Modelo de Servir por assessor e competência.
-- Alimentada manualmente (não há origem automática hoje); consumida pelo card
-- de Bônus de Captação da dash Private, que exige índice acima de 70 pontos.
-- Estrutura espelha euro_dash.dashboard_breakeven_targets.

create table if not exists euro_dash.dados_modelo_servir (
  id uuid primary key default gen_random_uuid(),
  periodo date not null,
  cod_assessor text not null,
  indice_modelo_servir numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dados_modelo_servir_periodo_dia1_chk
    check (extract(day from periodo) = 1),
  constraint dados_modelo_servir_indice_chk
    check (indice_modelo_servir >= 0 and indice_modelo_servir <= 100),
  constraint dados_modelo_servir_periodo_assessor_uk
    unique (periodo, cod_assessor)
);

comment on table euro_dash.dados_modelo_servir is
  'Índice do Modelo de Servir por assessor/competência. Carga manual. Usado no bônus de captação da dash Private.';
comment on column euro_dash.dados_modelo_servir.periodo is
  'Competência no primeiro dia do mês (ex.: 2026-08-01), no mesmo padrão de data_posicao da mv_resumo_assessor.';
comment on column euro_dash.dados_modelo_servir.cod_assessor is
  'Código do assessor no padrão AXXXXX, igual ao cod_assessor da mv_resumo_assessor.';
comment on column euro_dash.dados_modelo_servir.indice_modelo_servir is
  'Pontuação de 0 a 100. Acima de 70 o assessor fica elegível ao bônus de captação.';

alter table euro_dash.dados_modelo_servir enable row level security;

drop policy if exists authenticated_all on euro_dash.dados_modelo_servir;
create policy authenticated_all
  on euro_dash.dados_modelo_servir
  for all
  to authenticated
  using (true)
  with check (true);

grant all on table euro_dash.dados_modelo_servir to anon, authenticated, service_role;
