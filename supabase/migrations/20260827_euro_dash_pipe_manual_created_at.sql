alter table euro_dash.pipe_manual
  add column if not exists created_at timestamptz;

alter table euro_dash.pipe_manual
  alter column created_at set default now();

comment on column euro_dash.pipe_manual.created_at is
  'Data/hora em que a linha foi gravada. O sync horário apaga e reinsere a partir de 2026-08-21; max(created_at) nessas linhas é o último sync.';

update euro_dash.pipe_manual
set created_at = now()
where created_at is null
  and coalesce(id_atividade, 0) < 999000;

alter table public.pipe_manual
  add column if not exists created_at timestamptz;

alter table public.pipe_manual
  alter column created_at set default now();
