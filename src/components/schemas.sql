--DADOS CAPTACOES

create table public.dados_captacoes (
  id uuid not null default gen_random_uuid (),
  data_captacao date not null,
  cod_assessor text not null,
  cod_cliente text not null,
  tipo_captacao text not null,
  aux text null,
  valor_captacao numeric(15, 2) not null,
  data_atualizacao date not null default CURRENT_DATE,
  tipo_pessoa text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint dados_captacoes_pkey primary key (id),
  constraint unique_captacao_completa unique NULLS not distinct (
    data_captacao,
    cod_assessor,
    cod_cliente,
    tipo_captacao,
    aux,
    valor_captacao
  )
) TABLESPACE pg_default;

create index IF not exists idx_dados_captacoes_data_captacao on public.dados_captacoes using btree (data_captacao) TABLESPACE pg_default;

create index IF not exists idx_dados_captacoes_cod_assessor on public.dados_captacoes using btree (cod_assessor) TABLESPACE pg_default;

create index IF not exists idx_dados_captacoes_cod_cliente on public.dados_captacoes using btree (cod_cliente) TABLESPACE pg_default;

create index IF not exists idx_dados_captacoes_tipo_captacao on public.dados_captacoes using btree (tipo_captacao) TABLESPACE pg_default;

create index IF not exists idx_dados_captacoes_created_at on public.dados_captacoes using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_dados_captacoes_conflict_composite on public.dados_captacoes using btree (
  data_captacao,
  cod_assessor,
  cod_cliente,
  tipo_captacao,
  aux,
  valor_captacao,
  tipo_pessoa
) TABLESPACE pg_default;

create index IF not exists idx_dados_captacoes_recent on public.dados_captacoes using btree (created_at desc) TABLESPACE pg_default;

create trigger update_dados_captacoes_updated_at BEFORE
update on dados_captacoes for EACH row
execute FUNCTION update_updated_at_column ();

--DADOS CETIPADOS

create table public.dados_cetipados (
  id bigserial not null,
  data date null,
  assessor text null,
  cliente text null,
  fundo text null,
  valor text null,
  receita_estimada text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint dados_cetipados_pkey primary key (id),
  constraint dados_cetipados_unique unique (data, assessor, cliente, fundo, valor)
) TABLESPACE pg_default;

create index IF not exists idx_dados_cetipados_data on public.dados_cetipados using btree (data) TABLESPACE pg_default;

create index IF not exists idx_dados_cetipados_assessor on public.dados_cetipados using btree (assessor) TABLESPACE pg_default;

create index IF not exists idx_dados_cetipados_cliente on public.dados_cetipados using btree (cliente) TABLESPACE pg_default;

create index IF not exists idx_dados_cetipados_created_at on public.dados_cetipados using btree (created_at) TABLESPACE pg_default;

create trigger update_dados_cetipados_updated_at BEFORE
update on dados_cetipados for EACH row
execute FUNCTION update_updated_at_column ();

--DADOS DEMONSTRATIVO

create table public.dados_demonstrativo (
  id bigserial not null,
  categoria text null,
  produto text null,
  cod_cliente text null,
  data date null,
  comissao_bruta_rs_escritorio text null,
  cod_assessor_direto text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint dados_demonstrativo_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_dados_demonstrativo_cod_cliente on public.dados_demonstrativo using btree (cod_cliente) TABLESPACE pg_default;

create index IF not exists idx_dados_demonstrativo_data on public.dados_demonstrativo using btree (data) TABLESPACE pg_default;

create index IF not exists idx_dados_demonstrativo_cod_assessor_direto on public.dados_demonstrativo using btree (cod_assessor_direto) TABLESPACE pg_default;

create index IF not exists idx_dados_demonstrativo_created_at on public.dados_demonstrativo using btree (created_at) TABLESPACE pg_default;

create trigger update_dados_demonstrativo_updated_at BEFORE
update on dados_demonstrativo for EACH row
execute FUNCTION update_updated_at_column ();

--DADOS DRA_ANALITICO

create table public.dados_dra_analitico (
  id bigserial not null,
  cod_interno text null,
  nome_agente text null,
  papel text null,
  manual text null,
  c_pagar text null,
  familia_categoria text null,
  tipo_lancamento text null,
  perc_comissao text null,
  escr_vl_bruto text null,
  escr_vl_liquido text null,
  escr_vl_comis text null,
  ag_vl_bruto text null,
  ag_imp_perc text null,
  ag_imp_rs text null,
  ag_vl_liquido text null,
  areas_de_apoio_perc text null,
  unid_negocio_resp text null,
  competencia date null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint dados_dra_analitico_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_dados_dra_analitico_competencia on public.dados_dra_analitico using btree (competencia) TABLESPACE pg_default;

create index IF not exists idx_dados_dra_analitico_nome_agente on public.dados_dra_analitico using btree (nome_agente) TABLESPACE pg_default;

create index IF not exists idx_dados_dra_analitico_cod_interno on public.dados_dra_analitico using btree (cod_interno) TABLESPACE pg_default;

create index IF not exists idx_dados_dra_analitico_created_at on public.dados_dra_analitico using btree (created_at) TABLESPACE pg_default;

create trigger update_dados_dra_analitico_updated_at BEFORE
update on dados_dra_analitico for EACH row
execute FUNCTION update_updated_at_column ();

--DADOS FUNDOS

create table public.dados_fundos (
  id bigserial not null,
  codigo_operacao text null,
  operacao text null,
  data_agendamento_ordem date null,
  data_processamento date null,
  data_liquidacao date null,
  valor_solicitado text null,
  solicitante text null,
  status text null,
  codigo_assessor text null,
  comissao_escritorio text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint dados_fundos_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_dados_fundos_data_agendamento_ordem on public.dados_fundos using btree (data_agendamento_ordem) TABLESPACE pg_default;

create index IF not exists idx_dados_fundos_data_processamento on public.dados_fundos using btree (data_processamento) TABLESPACE pg_default;

create index IF not exists idx_dados_fundos_data_liquidacao on public.dados_fundos using btree (data_liquidacao) TABLESPACE pg_default;

create index IF not exists idx_dados_fundos_codigo_assessor on public.dados_fundos using btree (codigo_assessor) TABLESPACE pg_default;

create index IF not exists idx_dados_fundos_created_at on public.dados_fundos using btree (created_at) TABLESPACE pg_default;

create trigger update_dados_fundos_updated_at BEFORE
update on dados_fundos for EACH row
execute FUNCTION update_updated_at_column ();

--DADOS OFERTAS

create table public.dados_ofertas (
  id bigserial not null,
  codigo_aai text null,
  status_solicitacao_reserva text null,
  data_liquidacao_prevista date null,
  comissao_escritorio text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint dados_ofertas_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_dados_ofertas_data_liquidacao_prevista on public.dados_ofertas using btree (data_liquidacao_prevista) TABLESPACE pg_default;

create index IF not exists idx_dados_ofertas_codigo_aai on public.dados_ofertas using btree (codigo_aai) TABLESPACE pg_default;

create index IF not exists idx_dados_ofertas_created_at on public.dados_ofertas using btree (created_at) TABLESPACE pg_default;

create trigger update_dados_ofertas_updated_at BEFORE
update on dados_ofertas for EACH row
execute FUNCTION update_updated_at_column ();

--DADOS OFFSHORE_OPERACOES

create table public.dados_offshore_operacoes (
  id bigserial not null,
  date date null,
  cod_conta_brasil text null,
  data_abertura_conta date null,
  volume_financeiro_usd text null,
  valor_receita_usd text null,
  cod_assessor text null,
  nome_matriz text null,
  segmento text null,
  canal text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  identificador_unico_ordem text null,
  constraint dados_offshore_operacoes_pkey primary key (id),
  constraint dados_offshore_operacoes_identificador_unico_ordem_key unique (identificador_unico_ordem)
) TABLESPACE pg_default;

create index IF not exists idx_dados_offshore_operacoes_date on public.dados_offshore_operacoes using btree (date) TABLESPACE pg_default;

create index IF not exists idx_dados_offshore_operacoes_cod_assessor on public.dados_offshore_operacoes using btree (cod_assessor) TABLESPACE pg_default;

create index IF not exists idx_dados_offshore_operacoes_cod_conta_brasil on public.dados_offshore_operacoes using btree (cod_conta_brasil) TABLESPACE pg_default;

create index IF not exists idx_dados_offshore_operacoes_nome_matriz on public.dados_offshore_operacoes using btree (nome_matriz) TABLESPACE pg_default;

create index IF not exists idx_dados_offshore_operacoes_created_at on public.dados_offshore_operacoes using btree (created_at) TABLESPACE pg_default;

create trigger update_dados_offshore_operacoes_updated_at BEFORE
update on dados_offshore_operacoes for EACH row
execute FUNCTION update_updated_at_column ();

-- DADOS OFFSHORE_REMESSAS

create table public.dados_offshore_remessas (
  id bigserial not null,
  date date null,
  data_abertura_conta date null,
  valor_ordem_remessa_rs text null,
  taxa_percentual_spread text null,
  ordem_realizada_mercado text null,
  cod_assessor text null,
  nome_matriz text null,
  segmento text null,
  canal text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  identificador_unico_ordem text null,
  constraint dados_offshore_remessas_pkey primary key (id),
  constraint dados_offshore_remessas_identificador_unico_ordem_key unique (identificador_unico_ordem)
) TABLESPACE pg_default;

create index IF not exists idx_dados_offshore_remessas_date on public.dados_offshore_remessas using btree (date) TABLESPACE pg_default;

create index IF not exists idx_dados_offshore_remessas_cod_assessor on public.dados_offshore_remessas using btree (cod_assessor) TABLESPACE pg_default;

create index IF not exists idx_dados_offshore_remessas_nome_matriz on public.dados_offshore_remessas using btree (nome_matriz) TABLESPACE pg_default;

create index IF not exists idx_dados_offshore_remessas_created_at on public.dados_offshore_remessas using btree (created_at) TABLESPACE pg_default;

create trigger update_dados_offshore_remessas_updated_at BEFORE
update on dados_offshore_remessas for EACH row
execute FUNCTION update_updated_at_column ();

--DADOS PJ_CUSTODIA

create table public.dados_pj_custodia (
  id bigserial not null,
  data_foto_custodia date null,
  data_vencimento date null,
  codigo_assessor text null,
  receita_acruada_a_dividir text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  cod_conta text null,
  constraint dados_pj_custodia_pkey primary key (id),
  constraint dados_pj_custodia_unique_key unique (
    data_foto_custodia,
    data_vencimento,
    codigo_assessor,
    cod_conta,
    receita_acruada_a_dividir
  )
) TABLESPACE pg_default;

create index IF not exists idx_dados_pj_custodia_data_foto_custodia on public.dados_pj_custodia using btree (data_foto_custodia) TABLESPACE pg_default;

create index IF not exists idx_dados_pj_custodia_data_vencimento on public.dados_pj_custodia using btree (data_vencimento) TABLESPACE pg_default;

create index IF not exists idx_dados_pj_custodia_codigo_assessor on public.dados_pj_custodia using btree (codigo_assessor) TABLESPACE pg_default;

create index IF not exists idx_dados_pj_custodia_created_at on public.dados_pj_custodia using btree (created_at) TABLESPACE pg_default;

create trigger update_dados_pj_custodia_updated_at BEFORE
update on dados_pj_custodia for EACH row
execute FUNCTION update_updated_at_column ();

-- DADOS POSITIVADOR

create table public.dados_positivador (
  id bigserial not null,
  assessor text not null,
  cliente text not null,
  sexo text null,
  data_cadastro date null,
  data_nascimento date null,
  status text null,
  receita_bovespa text null,
  receita_futuros text null,
  receita_rf_bancarios text null,
  receita_rf_privados text null,
  receita_rf_publicos text null,
  net_em_m text null,
  tipo_pessoa text null,
  data_posicao date not null,
  data_atualizacao date not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint dados_positivador_pkey primary key (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists idx_positivador_unique on public.dados_positivador using btree (assessor, cliente, data_posicao) TABLESPACE pg_default;

create index IF not exists idx_positivador_assessor on public.dados_positivador using btree (assessor) TABLESPACE pg_default;

create index IF not exists idx_positivador_cliente on public.dados_positivador using btree (cliente) TABLESPACE pg_default;

create index IF not exists idx_positivador_data_posicao on public.dados_positivador using btree (data_posicao) TABLESPACE pg_default;

create index IF not exists idx_positivador_data_atualizacao on public.dados_positivador using btree (data_atualizacao) TABLESPACE pg_default;

create trigger update_dados_positivador_updated_at BEFORE
update on dados_positivador for EACH row
execute FUNCTION update_updated_at_column ();

--DADOS RF_FLUXO

create table public.dados_rf_fluxo (
  id bigserial not null,
  data date null,
  cod_assessor text null,
  cod_conta text null,
  nome_papel text null,
  indexador text null,
  tipo_operacao text null,
  volume text null,
  receita_a_dividir text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  pu_cliente text null,
  pu_tmr text null,
  taxa_cliente text null,
  taxa_tmr text null,
  constraint dados_rf_fluxo_pkey primary key (id),
  constraint dados_rf_fluxo_unique_key unique (
    data,
    cod_assessor,
    cod_conta,
    indexador,
    volume,
    receita_a_dividir,
    pu_cliente,
    pu_tmr,
    taxa_cliente,
    taxa_tmr
  )
) TABLESPACE pg_default;

create index IF not exists idx_dados_rf_fluxo_data on public.dados_rf_fluxo using btree (data) TABLESPACE pg_default;

create index IF not exists idx_dados_rf_fluxo_cod_assessor on public.dados_rf_fluxo using btree (cod_assessor) TABLESPACE pg_default;

create index IF not exists idx_dados_rf_fluxo_cod_conta on public.dados_rf_fluxo using btree (cod_conta) TABLESPACE pg_default;

create index IF not exists idx_dados_rf_fluxo_created_at on public.dados_rf_fluxo using btree (created_at) TABLESPACE pg_default;

create trigger update_dados_rf_fluxo_updated_at BEFORE
update on dados_rf_fluxo for EACH row
execute FUNCTION update_updated_at_column ();

-- DADOS RV_EXECUTADAS

create table public.dados_rv_executadas (
  id bigserial not null,
  data date null,
  cod_assessor text null,
  cod_conta text null,
  nome_papel text null,
  tipo_operacao text null,
  volume text null,
  receita_a_dividir text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint dados_rv_executadas_pkey primary key (id),
  constraint dados_rv_executadas_unique_key unique (
    data,
    cod_assessor,
    cod_conta,
    nome_papel,
    tipo_operacao,
    volume,
    receita_a_dividir
  )
) TABLESPACE pg_default;

create index IF not exists idx_dados_rv_executadas_data on public.dados_rv_executadas using btree (data) TABLESPACE pg_default;

create index IF not exists idx_dados_rv_executadas_cod_assessor on public.dados_rv_executadas using btree (cod_assessor) TABLESPACE pg_default;

create index IF not exists idx_dados_rv_executadas_cod_conta on public.dados_rv_executadas using btree (cod_conta) TABLESPACE pg_default;

create index IF not exists idx_dados_rv_executadas_created_at on public.dados_rv_executadas using btree (created_at) TABLESPACE pg_default;

create trigger update_dados_rv_executadas_updated_at BEFORE
update on dados_rv_executadas for EACH row
execute FUNCTION update_updated_at_column ();

-- DADOS TRANSFERENCIAS

create table public.dados_transferencias (
  id bigserial not null,
  cod_cliente text null,
  cod_assessor_origem text null,
  cod_assessor_destino text null,
  data_solicitacao date null,
  data_transferencia date null,
  status text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  cod_solicitacao text null,
  constraint dados_transferencias_pkey primary key (id),
  constraint dados_transferencias_cod_solicitacao_key unique (cod_solicitacao)
) TABLESPACE pg_default;

create index IF not exists idx_dados_transferencias_cod_cliente on public.dados_transferencias using btree (cod_cliente) TABLESPACE pg_default;

create index IF not exists idx_dados_transferencias_cod_assessor_origem on public.dados_transferencias using btree (cod_assessor_origem) TABLESPACE pg_default;

create index IF not exists idx_dados_transferencias_cod_assessor_destino on public.dados_transferencias using btree (cod_assessor_destino) TABLESPACE pg_default;

create index IF not exists idx_dados_transferencias_data_transferencia on public.dados_transferencias using btree (data_transferencia) TABLESPACE pg_default;

create index IF not exists idx_dados_transferencias_created_at on public.dados_transferencias using btree (created_at) TABLESPACE pg_default;

create trigger update_dados_transferencias_updated_at BEFORE
update on dados_transferencias for EACH row
execute FUNCTION update_updated_at_column ();