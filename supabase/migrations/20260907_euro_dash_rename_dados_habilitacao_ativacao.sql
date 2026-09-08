-- Renomeia dados_consorcio_contas para o nome definitivo da carga.

alter table if exists euro_dash.dados_consorcio_contas
  rename to dados_habilitacao_ativacao;

alter table euro_dash.dados_habilitacao_ativacao
  rename constraint dados_consorcio_contas_fonte_chk to dados_habilitacao_ativacao_fonte_chk;

alter table euro_dash.dados_habilitacao_ativacao
  rename constraint dados_consorcio_contas_fonte_conta_data_uk to dados_habilitacao_ativacao_fonte_conta_data_uk;

alter index if exists euro_dash.idx_dados_consorcio_contas_fonte_data
  rename to idx_dados_habilitacao_ativacao_fonte_data;

alter index if exists euro_dash.idx_dados_consorcio_contas_assessor_data
  rename to idx_dados_habilitacao_ativacao_assessor_data;

comment on table euro_dash.dados_habilitacao_ativacao is
  'Habilitações e ativações de contas. fonte = habilitacao | ativacao.';
comment on column euro_dash.dados_habilitacao_ativacao.fonte is
  'habilitacao = abertura de conta; ativacao = conta recebeu aporte e deixou de estar zerada.';
comment on column euro_dash.dados_habilitacao_ativacao.conta_ativada is
  'Preenchida só em habilitação. Indica se a conta aberta também foi ativada.';
comment on column euro_dash.dados_habilitacao_ativacao.cod_assessor is
  'Código do assessor no padrão AXXXXX, igual ao cod_assessor da mv_resumo_assessor.';
comment on column euro_dash.dados_habilitacao_ativacao.faixa is
  'Faixa da conta (ex.: valor/segmento informado na carga).';

grant all on table euro_dash.dados_habilitacao_ativacao to anon, authenticated, service_role;
