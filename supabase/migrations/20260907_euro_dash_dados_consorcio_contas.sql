-- Habilitações (abertura de conta) e ativações (primeiro aporte / conta deixa de estar zerada).
-- Uma tabela só: fonte diferencia a origem; conta_ativada existe só em habilitação.

create table if not exists euro_dash.dados_consorcio_contas (
  id uuid primary key default gen_random_uuid(),
  fonte text not null,
  conta text not null,
  cod_assessor text not null,
  data date not null,
  faixa text,
  conta_ativada text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dados_consorcio_contas_fonte_chk
    check (fonte in ('habilitacao', 'ativacao')),
  constraint dados_consorcio_contas_fonte_conta_data_uk
    unique (fonte, conta, data)
);

comment on table euro_dash.dados_consorcio_contas is
  'Habilitações e ativações de contas de consórcio. fonte = habilitacao | ativacao.';
comment on column euro_dash.dados_consorcio_contas.fonte is
  'habilitacao = abertura de conta; ativacao = conta recebeu aporte e deixou de estar zerada.';
comment on column euro_dash.dados_consorcio_contas.conta_ativada is
  'Preenchida só em habilitação. Indica se a conta aberta também foi ativada.';
comment on column euro_dash.dados_consorcio_contas.cod_assessor is
  'Código do assessor no padrão AXXXXX, igual ao cod_assessor da mv_resumo_assessor.';
comment on column euro_dash.dados_consorcio_contas.faixa is
  'Faixa da conta (ex.: valor/segmento informado na carga).';

create index if not exists idx_dados_consorcio_contas_fonte_data
  on euro_dash.dados_consorcio_contas (fonte, data);
create index if not exists idx_dados_consorcio_contas_assessor_data
  on euro_dash.dados_consorcio_contas (cod_assessor, data);

alter table euro_dash.dados_consorcio_contas enable row level security;

drop policy if exists authenticated_all on euro_dash.dados_consorcio_contas;
create policy authenticated_all
  on euro_dash.dados_consorcio_contas
  for all
  to authenticated
  using (true)
  with check (true);

grant all on table euro_dash.dados_consorcio_contas to anon, authenticated, service_role;
