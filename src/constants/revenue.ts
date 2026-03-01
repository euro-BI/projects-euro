export const PRODUCT_KEYS = {
  receita_b3: "B3",
  receita_renda_fixa: "Renda Fixa",
  receitas_ofertas_fundos: "Fundos",
  receitas_ofertas_rf: "Ofertas RF",
  asset_m_1: "Asset",
  receita_seguros: "Seguros",
  receita_previdencia: "Previdência",
  receitas_estruturadas: "Estruturados",
  receita_cetipados: "Cetipados",
  receita_cambio: "Câmbio",
  receita_compromissadas: "Compromissadas",
  receitas_offshore: "Offshore",
  receita_consorcios: "Consórcios"
};

export const REPASSE_CONFIG = {
  investimentos: {
    base: 0.82,
    produtos: {
      receita_b3: 0.40,
      receitas_estruturadas: 0.40,
      
      receita_cetipados: 0.50,
      receita_renda_fixa: 0.50,
      receita_previdencia: 0.50,
      
      receitas_ofertas_fundos: 0.50,
      receitas_ofertas_rf: 0.50,
      asset_m_1: 0.50,
      
      receita_cambio: 0.50,
      receita_compromissadas: 0.50,
      receitas_offshore: 0.50
    }
  },
  cross_sell: {
    base: 0.85,
    produtos: {
      receita_seguros: 0.30,
      receita_consorcios: 0.30
    }
  }
};
