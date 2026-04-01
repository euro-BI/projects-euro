
export interface AssessorResumo {
  // Identificação
  cod_assessor: string;
  nome_assessor: string;
  email: string;
  foto_url: string | null;
  lider: boolean;
  status_assessor: string;
  chave_data_assessor: string;
  data_posicao: string;
  time: string;
  cluster: string;

  // Custódia e Clientes
  custodia_net: number;
  total_clientes: number;
  total_fp_300k: number;
  meta_fp300k: number;

  // Receita por Produto
  receita_b3: number;
  asset_m_1: number;
  receitas_estruturadas: number;
  receita_cetipados: number;
  receitas_ofertas_fundos: number;
  receitas_ofertas_rf: number;
  receita_renda_fixa: number;
  receita_seguros: number;
  receita_previdencia: number;
  receita_consorcios: number;
  receita_cambio: number;
  receita_compromissadas: number;
  receitas_offshore: number;
  receita_total: number;
  meta_receita: number;
  faturamento_pj1: number;
  faturamento_pj2: number;
  repasse_total: number;

  // Captação
  captacao_entradas: number;
  captacao_saidas: number;
  captacao_liquida: number;
  captacao_entrada_transf: number;
  captacao_saida_transf: number;
  captacao_transf_liquida: number;
  captacao_liquida_total: number;
  meta_captacao: number;

  // Pontuação e Metas
  pontos_captacao: number;
  pontos_roa_invest: number;
  pontos_roa_cs: number;
  ativacao_300k: number;
  ativacao_1kk: number;
  pontos_ativacoes: number;
  pontos_lider: number;
  pontos_lider_roa: number;
  pontos_lider_cap: number;
  pontos_total: number;
  pontos_totais_acumulado: number;
  meta_ativacao_300k: number;
  roa: number;
  
  // Elegibilidade Super Ranking
  total_clientes_ruptura?: number;
  media_movel_clientes_6m?: number;
  media_movel_rupturas_6m?: number;
  elegibilidade?: boolean;
}

export interface FacebookAdsData {
  id: number;
  account_name: string;
  campaign_name: string;
  adset_name: string;
  ad_name: string;
  impressions: number;
  reach: number;
  inline_link_clicks: number;
  spend: number;
  cost_per_result: number;
  results: number;
  date_start: string;
  date_stop: string;
  created_at: string;
}

export type TimeResumo = {
  time: string;
  receita_total: number;
  meta_receita: number;
  captacao_liquida_total: number;
  meta_captacao: number;
  custodia_net: number;
  roa_medio: number;
  pontos_lider_acumulado: number;
  assessores_ativos: number;
};
