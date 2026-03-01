# PROMPT: IDENTIDADE VISUAL — EUROSTOCK PERFORMANCE DASHBOARD

---

## CONTEXTO DO PROJETO (PRÉ-PREENCHIDO)

- **Nome do projeto:** Eurostock Performance Dashboard
- **O que faz:** Dashboard de análise de performance dos assessores de investimento — acompanhamento mensal de custódia, captação, receita, ROA, pontuação e metas. Os dados vêm da materialized view `mv_resumo_assessor` via Supabase.
- **Para quem:** Líderes de time e gestores da Eurostock que precisam monitorar e comparar a performance dos assessores. Nível de sofisticação alto — conhecem os indicadores profundamente, não precisam de explicação básica, precisam de julgamento rápido.
- **Tipo de dado dominante:** Rankings e comparações entre assessores, séries temporais mensais de captação/receita/pontuação, composição de receita por produto, atingimento de metas, clusters de performance.
- **Sensação desejada:** Sala de operações de um fundo de investimento. Frieza analítica com pulso — como abrir um relatório de gestão de alto nível onde cada número já vem com seu veredicto. Não é relatório de RH. É cockpit de gestão de performance.
- **O que NÃO quer parecer:** Dashboard de RH genérico, Excel reestilizado, PowerPoint corporativo, painel de gamificação com medalhas, Tableau com paleta padrão.
- **Mode:** Dark — alinhado à identidade visual do site da Eurostock (fundo escuro navy/preto).
- **Referência de energia:** "A frieza do Bloomberg Terminal + a hierarquia editorial do FT + a precisão de gestão do Linear"
- **Cor accent:** `#FAC017` — rgb(250, 192, 23) — o dourado da Eurostock. UMA cor. Todo o resto é neutro.

---

## FONTE DE DADOS — `mv_resumo_assessor` via Supabase

O sistema já tem conexão com o Supabase configurada. A IA que implementa deve buscar os dados diretamente desta materialized view. Abaixo o mapeamento completo das colunas disponíveis e como cada uma se traduz em narrativa visual:

### Identificação do Assessor
| Coluna | Tipo | Uso no Dashboard |
|---|---|---|
| `cod_assessor` | string (ex: "A001") | Identificador primário — sempre visível |
| `nome_assessor` | string | Nome exibido nos cards e rankings |
| `email` | string | Metadado — não exibir em destaque |
| `foto_url` | URL | Avatar do assessor nos cards de perfil |
| `lider` | boolean | Badge visual diferenciado + `pontos_lider` |
| `status_assessor` | string | Indicador de status no histórico de times |
| `chave_data_assessor` | string (YYYYMM\|cod) | Chave composta para queries específicas |
| `data_posicao` | date | Base de referência temporal — filtro principal |
| `time` | string | Agrupador de equipe — filtro e segmentação |
| `cluster` | string (A/B/C/outro) | Segmentação de performance — encoding visual |

### Custódia e Base de Clientes
| Coluna | Tipo | Narrativa |
|---|---|---|
| `custodia_net` | decimal | O tamanho da carteira — métrica de peso do assessor |
| `total_clientes` | integer | Base ativa com saldo relevante |
| `total_fp_300k` | integer | Clientes PF 300K+ com completude 100% |
| `meta_fp300k` | integer | Meta de clientes PF 300K+ (denominador do atingimento) |

### Receita por Produto
| Coluna | Tipo | Narrativa |
|---|---|---|
| `receita_b3` | decimal | B3: Bovespa + Futuros ponderado pelo repasse |
| `asset_m_1` | decimal | Asset M-1: comissões deslocadas um mês |
| `receitas_estruturadas` | decimal | Produtos estruturados (faturamento + RV) |
| `receita_cetipados` | decimal | Cetipados: estimativa de produtos cetipados |
| `receitas_ofertas_fundos` | decimal | Ofertas de fundos (fee + volume + fator) |
| `receitas_ofertas_rf` | decimal | Ofertas de renda fixa |
| `receita_renda_fixa` | decimal | Fluxo de renda fixa (aplicações) |
| `receita_seguros` | decimal | Seguros |
| `receita_previdencia` | decimal | Previdência (competência +1 mês) |
| `receita_consorcios` | decimal | Consórcios |
| `receita_cambio` | decimal | Câmbio PJ |
| `receita_compromissadas` | decimal | Compromissadas |
| `receitas_offshore` | decimal | Offshore (operações + remessas) |
| `receita_total` | decimal | **Receita bruta consolidada — métrica central** |
| `meta_receita` | decimal | Meta teórica: 1% a.a. / custódia (mensalizado) |
| `faturamento_pj1` | decimal | Faturamento consolidado PJ1 |
| `faturamento_pj2` | decimal | Faturamento consolidado PJ2 |
| `repasse_total` | decimal | Repasse estimado ao assessor |

### Captação
| Coluna | Tipo | Narrativa |
|---|---|---|
| `captacao_entradas` | decimal | Entradas brutas no mês |
| `captacao_saidas` | decimal | Saídas (valores negativos) |
| `captacao_liquida` | decimal | Líquido de movimentações |
| `captacao_entrada_transf` | decimal | Entradas via transferência entre assessores |
| `captacao_saida_transf` | decimal | Saídas via transferência entre assessores |
| `captacao_transf_liquida` | decimal | Saldo líquido de transferências |
| `captacao_liquida_total` | decimal | **Captação total (movimentações + transferências)** |
| `meta_captacao` | decimal | Meta de captação do assessor no mês |

### Pontuação e Metas
| Coluna | Tipo | Narrativa |
|---|---|---|
| `pontos_captacao` | decimal | Pontos de captação (limitado a 200% da meta) |
| `pontos_roa_invest` | decimal | Pontos de ROA investimentos (limite: 70pts) |
| `pontos_roa_cs` | decimal | Pontos de ROA cross-sell (limite: 30pts) |
| `ativacao_300k` | integer | Ativações entre 300K e 1M no mês |
| `ativacao_1kk` | integer | Ativações acima de 1M no mês |
| `pontos_ativacoes` | decimal | Pontos: 1kk=50pts, 300k=20pts |
| `pontos_lider` | decimal | Bônus de liderança (20pts se líder) |
| `pontos_total` | decimal | **Pontuação total do mês** |
| `pontos_totais_acumulado` | decimal | **Pontuação acumulada no ano — ranking YTD** |
| `meta_ativacao_300k` | decimal | Meta de ativações 300K+ |
| `roa` | decimal | ROA anualizado (receita / custódia * 12) |

---

## O QUE ESTE PROMPT FAZ

Você vai criar uma identidade visual ORIGINAL para o dashboard de performance da Eurostock. Não é trocar cores de um template. É criar uma experiência onde cada número já carrega seu veredicto — onde o gestor abre o dashboard e em 10 segundos sabe quem está performando, quem está em risco, e o que mudou em relação ao mês anterior.

A interface age como um analista sênior de gestão: ela já fez o trabalho de interpretação. O gestor confirma, explora, e age.

---

## A MENTALIDADE DO GESTOR DE ASSESSORES

Quem usa este dashboard não está aprendendo sobre os dados. Está tomando decisões.

As perguntas que ele precisa responder em segundos:
- **"Quem são os top performers deste mês?"** → ranking com contexto de evolução, não só posição atual
- **"Alguém caiu muito em relação ao mês passado?"** → mudança de posição visível, não apenas valor absoluto
- **"Qual assessor está abaixo da meta de receita?"** → atingimento vs. meta com encoding semântico claro
- **"Como está a captação líquida do time?"** → entradas vs. saídas vs. transferências como composição visual
- **"Quem está dominando em pontuação acumulada?"** → YTD ranking com trajetória mensal

A interface responde essas perguntas ANTES do gestor precisar formulá-las. Esse é o padrão.

---

## HIERARQUIA DE MÉTRICAS (O QUE IMPORTA MAIS)

A interface deve refletir a importância relativa das métricas. Não tudo tem o mesmo peso:

**Tier 1 — Métricas de Resultado (manchete visual):**
- `pontos_totais_acumulado` — o placar geral do ano
- `receita_total` vs. `meta_receita` — o veredicto financeiro do mês
- `captacao_liquida_total` vs. `meta_captacao` — o sangue novo da carteira

**Tier 2 — Métricas de Composição (contexto):**
- Breakdown de receita por produto (os 13 tipos de receita)
- `custodia_net` — o tamanho da base que gera tudo
- `roa` — eficiência relativa (desacopla tamanho de carteira de performance)

**Tier 3 — Métricas de Detalhe (drill-down):**
- `ativacao_300k` e `ativacao_1kk` — eventos de ativação granulares
- `total_fp_300k` vs. `meta_fp300k` — completude da base premium
- Breakdown de captação (entradas / saídas / transferências separados)

A manchete do dashboard usa Tier 1. Os gráficos de contexto usam Tier 2. Tabelas e drill-downs usam Tier 3.

---

## A REGRA DAS BIBLIOTECAS DE GRÁFICOS

### PROIBIDO:
- **Recharts** — zero personalidade, padrão do React
- **Chart.js** — canvas genérico, limitações de anotação
- **Victory** — previsível
- **ApexCharts** — aparência de dashboard corporativo anos 2010

### OBRIGATÓRIO para este projeto — combinação recomendada:

| Biblioteca | Por quê neste projeto |
|---|---|
| **Visx (Airbnb)** | Primitivos React sobre D3 — controle total sobre encoding e anotações sem sair do ecossistema React. Ideal para o ranking com trajetória e o breakdown de receita customizado |
| **Observable Plot** | DNA editorial do FT/NYT — perfeito para o slope chart de evolução de ranking e o gráfico de captação com encoding semântico |
| **D3.js** (quando necessário) | Para anotações cirúrgicas que nem Visx nem Observable Plot entregam nativamente — como o bullet chart de meta de receita e os sparklines narrativos |

A combinação Visx + Observable Plot cobre 90% dos casos. D3 puro entra apenas quando o conceito exige controle de pixel que as outras não dão.

---

## AS QUATRO CAMADAS DO STORYTELLING VISUAL

### Camada 1: ESTRUTURA NARRATIVA

**Hierarquia editorial:**
O dashboard tem três zonas de leitura em ordem de peso visual:

1. **MANCHETE** — faixa superior com o placar do mês: pontuação acumulada do líder do ranking, receita total do time vs. meta, e captação líquida total. Tipografia dramática, números grandes, delta vs. mês anterior inline. O gestor lê isso e já tem o resumo executivo.

2. **CONTEXTO** — zona central com os gráficos que explicam a manchete: ranking de assessores com evolução, breakdown de receita por produto, trajetória de captação, distribuição de ROA.

3. **DETALHE** — zona inferior ou painel lateral com tabela completa de assessores, drill-down individual ao clicar num nome, breakdown granular de pontuação por componente.

**Filtros como narrativa:**
O filtro de `data_posicao` (mês de referência) e `time` (equipe) não são elementos secundários — ficam no topo da manchete como contexto editorial: "Performance · Fevereiro 2025 · Time Sul". Ao mudar o filtro, a manchete atualiza primeiro, depois o contexto, depois o detalhe — a ordem de leitura se mantém.

**Navegação:**
Sem sidebar pesada. Navegação horizontal discreta no topo — abas para: Visão Geral / Ranking / Receita / Captação / Assessor Individual. O peso visual das abas é mínimo — a manchete domina.

### Camada 2: LINGUAGEM VISUAL

**Tipografia:**
-184→- `font-display`: **JetBrains Mono** — para os números grandes da manchete (pontuação acumulada, receita total, captação). Tipografia com personalidade de relatório financeiro de alto nível.
- `font-editorial`: **Lora** — para anotações dentro de gráficos, tooltips narrativos, insights textuais. Transmite julgamento analítico, não dado bruto.
- `font-ui`: **DM Sans** — para labels de navegação, filtros, botões. Limpo mas não genérico.
- `font-data`: **JetBrains Mono** — para valores em tabelas, eixos de gráficos, `cod_assessor`, percentuais de atingimento. Precisão tabular.

**Sistema de cor:**
Base dark (fundo navy/preto da Eurostock) + **`#FAC017`** como ÚNICA cor vibrante. Nada mais.

O dourado aparece em: assessor em destaque no ranking, série principal nos gráficos de tendência, badges de líder, barra de meta atingida, ícone de ponto de ativação 1kk. Todo o resto — cinzas, brancos, neutros escuros.

**Encoding semântico de cor:**
- Acima da meta: dourado `#FAC017`
- Abaixo da meta: cinza médio com hachura sutil (não vermelho — vermelho é para anomalias, não para "abaixo da meta")
- Queda significativa vs. mês anterior: `data-negative` vermelho funcional — mas APENAS em anotações de anomalia, nunca como cor de categoria
- Cluster A: sem cor especial — o ranking já comunica. Cluster B/C: opacidade reduzida no ranking (contexto, não destaque)

**Geometria:**
Cantos retos ou radius mínimo (2-4px) nos gráficos — frieza analítica. Cards com radius moderado (8px) para respirar. Nenhum pill border. Nenhum glassmorphism. A interface é séria.

**Densidade:**
Alta — como Bloomberg. O gestor conhece os dados, não precisa de espaço vazio para "descansar o olhar". Informação densa com hierarquia clara é mais respeitosa do que espaço vazio com pouca informação.

**Eixos e grids:**
Eixos mínimos — apenas linha de base (zero) quando necessária. Grid horizontal com opacidade 8-10%, cor neutra. Sem grid vertical. Labels de eixo em `font-data` tamanho mínimo, `text-muted`.

### Camada 3: ANATOMIA DOS GRÁFICOS

**Sistema de anotações:**
Cada gráfico principal tem pelo menos UMA anotação editorial que diz o que o dado significa, não apenas o que ele é.

Exemplos concretos para este dashboard:
- No gráfico de captação mensal: linha vertical no mês onde `captacao_liquida_total` ficou negativo pela última vez, com label "Última saída líquida"
- No ranking de pontuação: assessores com `pontos_lider = 20` têm um badge dourado inline no nome — não ícone genérico, um marcador editorial discreto
- No breakdown de receita: o produto com maior crescimento vs. mês anterior tem um pequeno marcador dourado + label "↑ maior variação"
- No gráfico de ROA: linha tracejada mostrando o ROA médio do time como referência

**Encoding semântico específico:**
- `roa` acima de 1% a.a.: área de fundo levemente dourada (accent-subtle)
- `captacao_liquida_total` negativo: área vermelha translúcida no período
- Assessor com `pontos_totais_acumulado` no top 3: row destacada no ranking com borda esquerda dourada de 2px
- `ativacao_1kk > 0`: indicador especial — estrela ou marcador dourado no card do assessor (50 pontos é evento raro, merece tratamento visual)

**Hierarquia dentro dos gráficos:**
- Assessor selecionado/em foco: linha/barra em `accent-primary`, espessura 2.5px
- Demais assessores: linhas em `data-context` (cinza 40%), espessura 1px
- Médias e metas: tracejado em neutro escuro, espessura 1px, sem rótulo inline (legenda discreta)

### Camada 4: RITMO EDITORIAL

**A Manchete:**
A primeira coisa que o gestor vê ao abrir o dashboard não é uma tabela de assessores. É o estado do time naquele mês — três números em tipografia dramática:

1. **Pontuação do líder no ranking acumulado** (`pontos_totais_acumulado` do primeiro colocado) — número grande em `font-display`, nome do assessor em `font-ui` abaixo
2. **Receita total do time vs. meta** — percentual de atingimento com encoding de cor (dourado se ≥100%, neutro se <100%), e delta vs. mês anterior
3. **Captação líquida total do time** — com decomposição inline: "Entradas R$X · Saídas R$Y · Transferências R$Z"

Ao lado desses três números, uma linha narrativa em `font-editorial` gerada dinamicamente: "Time Sul · Fevereiro 2025 · 12 assessores ativos · ROA médio de 0,82%"

**O Desenvolvimento:**
Logo abaixo da manchete, em ordem de peso visual decrescente:
1. Ranking de assessores por `pontos_totais_acumulado` — com trajetória dos últimos 3 meses
2. Gráfico de captação mensal — com decomposição entradas/saídas/transferências
3. Breakdown de receita por produto — composição do mês atual

**O Detalhe:**
Tabela completa abaixo dos gráficos principais, com todas as métricas por assessor. Clique em qualquer assessor abre um painel lateral (sheet) com a visão individual completa — sparklines de cada métrica, histórico de pontuação, breakdown de receita.

---

## CONCEITOS VISUAIS POR COMPONENTE

### 1. Ranking de Pontuação Acumulada (YTD)

**Representa:** O placar do campeonato interno. Não é uma lista — é uma competição em andamento onde a posição atual é menos importante do que a trajetória.

**Descoberta que comunica:** "Quem está subindo, quem está caindo, e quem domina o ano."

**Biblioteca:** Visx — para controle total sobre o slope visual e as anotações inline.

**Anatomia detalhada:**
A visualização tem dois momentos lado a lado: posição no mês anterior (esquerda) e posição no mês atual (direita). Linhas conectam cada assessor entre os dois momentos — a inclinação da linha é a narrativa. Assessor subindo: linha em dourado `accent-primary`. Assessor descendo: linha em `data-negative` translúcido. Assessor estável no topo: linha em dourado espessa (2.5px). Todos os outros: linhas finas em `data-context` (cinza 40%).

À direita de cada nome no ranking atual: `pontos_totais_acumulado` em `font-data`, e um delta em tamanho menor ("+340pts vs. mês anterior") em `font-editorial`.

Assessores com `lider = true` têm um marcador dourado discreto ao lado do nome — não um ícone de estrela, mas um traço vertical dourado de 2px que serve como identidade de liderança.

Ao hover em qualquer assessor: a linha desse assessor vai para frente (z-index), todas as outras ficam em opacity 20%, e um tooltip narrativo aparece com: nome, posição atual, delta de posição, `pontos_total` do mês, e uma linha em `font-editorial` com o componente que mais contribuiu para a mudança.

**Viabilidade:** Código puro com Visx.

---

### 2. Gráfico de Captação Mensal com Decomposição

**Representa:** O fluxo de dinheiro — não apenas quanto entrou, mas de onde veio e para onde foi.

**Descoberta que comunica:** "A captação líquida esconde três histórias diferentes: movimentação orgânica, transferências de entrada, e transferências de saída."

**Biblioteca:** Observable Plot — encoding semântico natural com grammar of graphics.

**Anatomia detalhada:**
Gráfico de barras empilhadas verticais por mês (eixo X = `data_posicao` dos últimos 12 meses). Cada barra tem três segmentos:
- `captacao_entradas`: segmento superior positivo, cor `accent-subtle` (dourado muito translúcido)
- `captacao_entrada_transf`: segmento adicional positivo, cor neutra clara
- `captacao_saidas`: segmento negativo (abaixo do zero), cor `data-context`
- `captacao_saida_transf`: segmento negativo adicional, cor `data-context` mais escuro

Uma linha fina sobreposta em `accent-primary` conecta os pontos de `captacao_liquida_total` mês a mês — é o veredicto: a linha acima do zero é vitória, abaixo é alerta.

Quando `captacao_liquida_total` é negativo em algum mês: área de fundo daquele mês preenchida com `data-anomaly-bg` (vermelho muito translúcido). Label acima da área: "Saída líquida".

A linha de `meta_captacao` aparece como tracejado horizontal dourado no nível da meta do mês em foco. Quando a barra total supera a meta, um ponto dourado marca o topo da barra.

Tooltip ao hover: "Fevereiro 2025 · Captação líquida: R$X · Entradas: R$Y · Saídas: R$Z · Transferências: ±R$W · Meta: R$M · Atingimento: XX%"

**Viabilidade:** Código puro com Observable Plot.

---

### 3. Breakdown de Receita por Produto (Composição)

**Representa:** De onde vem o dinheiro — a saúde do mix de produtos de cada assessor.

**Descoberta que comunica:** "Um assessor com receita alta concentrada em um produto é mais frágil do que um com receita menor mas distribuída."

**Biblioteca:** Visx — para o treemap customizado com encoding de variação.

**Anatomia detalhada:**
Não é um gráfico de pizza. É um treemap de retângulos onde o tamanho de cada retângulo representa a proporção da receita daquele produto no total (`receita_total`). Os 13 produtos de receita são os retângulos.

Cor dos retângulos: base neutra escura (`surface-elevated`). O produto com maior crescimento vs. mês anterior recebe borda dourada de 1px e um marcador de texto interno "↑". O produto com maior queda recebe borda em `data-negative` translúcida.

Label dentro de cada retângulo (quando o tamanho permite): nome do produto em `font-data` tamanho mínimo + valor em `font-data`.

Retângulos muito pequenos (receita < 2% do total) se agrupam num retângulo "Outros" em cinza mais escuro.

Tooltip ao hover: "Receita de Previdência · R$X · +12% vs. Jan · 8,3% do total"

**Viabilidade:** Código puro com Visx.

---

### 4. Painel de ROA — Distribuição e Posição

**Representa:** A eficiência relativa dos assessores — desacopla o tamanho da carteira da qualidade da geração de receita.

**Descoberta que comunica:** "Assessores com custódia grande nem sempre têm o melhor ROA. Os mais eficientes ficam visíveis aqui."

**Biblioteca:** Observable Plot — dot plot com encoding múltiplo.

**Anatomia detalhada:**
Dot plot horizontal onde cada ponto é um assessor. Eixo X = `roa` (ROA anualizado). Tamanho do ponto = `custodia_net` (maior custódia = ponto maior). Cor: assessores acima de 1% de ROA em `accent-primary`; abaixo em `data-context`.

Linha vertical tracejada na posição do ROA médio do time — label inline: "Média do time: 0,82%". Linha vertical tracejada em 1,0% — label inline: "Referência 1% a.a."

Zona entre 0% e a média: fundo `surface-inset` discreto. Zona acima de 1%: fundo `accent-subtle` muito translúcido.

Assessores com `lider = true` têm o ponto com borda dourada de 1.5px.

Tooltip ao hover: "Assessor Nome · ROA: 1,23% a.a. · Custódia: R$X · Receita total: R$Y · Posição no ROA: 3º do time"

**Viabilidade:** Código puro com Observable Plot.

---

### 5. Card Individual do Assessor (Drill-down)

**Representa:** O dossiê completo de um assessor — toda a sua performance em uma única visão coerente.

**Descoberta que comunica:** "Em que esse assessor é forte, onde está abaixo do esperado, e como sua trajetória evoluiu nos últimos meses."

**Biblioteca:** Combinação de Visx (sparklines) + Observable Plot (bullet charts de meta).

**Anatomia detalhada:**
Painel lateral (sheet) com três zonas:

**Zona superior — identidade e resumo:**
Foto (`foto_url`) em avatar redondo com borda dourada se `lider = true`. Nome em `font-display`. `cod_assessor` em `font-data text-muted`. Badge de `cluster` (A/B/C) com background `surface-elevated` e texto em `text-secondary`. Badge de `time`. Linha de resumo em `font-editorial`: "Posição #X no ranking YTD · ROA de X% · Receita X% da meta"

**Zona central — bullet charts de meta:**
Para cada métrica com meta (`receita_total` vs. `meta_receita`, `captacao_liquida_total` vs. `meta_captacao`, `total_fp_300k` vs. `meta_fp300k`), um bullet chart horizontal:
- Barra de fundo larga em `surface-elevated` = range da meta
- Barra interna em `accent-primary` = valor atual (largura proporcional ao atingimento)
- Marcador vertical fino em branco = posição da meta (100%)
- Label à direita: percentual de atingimento em `font-data`
- Se acima de 100%: barra transborda a meta com opacidade reduzida (o excesso é visível mas não dominante)

**Zona inferior — sparklines de trajetória:**
Grid de sparklines para os últimos 12 meses de: `pontos_total`, `receita_total`, `captacao_liquida_total`, `roa`. Cada sparkline em `font-data` tem o valor do mês atual à direita e o delta em `text-muted`.

O ponto mais alto de cada sparkline recebe um marcador dourado. O ponto mais baixo recebe um marcador cinza.

**Viabilidade:** Código puro com Visx + Observable Plot.

---

### 6. Empty State / Estado de Carregamento

**Representa:** Não "sem dados" — é o momento antes da revelação. A interface mantém sua personalidade mesmo vazia.

**Anatomia detalhada:**
Ao invés de spinner genérico, o skeleton loading usa retângulos com a forma exata dos componentes que vão aparecer — o gestor já sabe o que está sendo carregado. Os skeletons têm animação de shimmer em `surface-elevated` com `accent-subtle` passando sutilmente.

Empty state (quando filtro não retorna dados): em vez de ilustração genérica, uma linha em `font-editorial text-muted` no centro: "Nenhum assessor encontrado para este período. Ajuste os filtros acima." — sem ícone, sem ilustração. A frieza do texto é intencional — é um dashboard analítico, não um app amigável.

---

## TOKENS DE DESIGN

### Cores — Fundos
| Token | Valor | Uso |
|---|---|---|
| `surface-page` | `#0A0D12` | Fundo principal da aplicação |
| `surface-card` | `#111520` | Cards, painéis, zonas de conteúdo |
| `surface-elevated` | `#1A2030` | Elementos elevados, tooltips, hover states de row |
| `surface-inset` | `#080B0F` | Áreas de código, zonas de detalhe, fundos de tabela |
| `surface-overlay` | `#0A0D12E6` | Overlay de modais e sheets (90% opaco) |

### Cores — Texto
| Token | Valor | Uso |
|---|---|---|
| `text-headline` | `#F5F5F0` | Números grandes, manchetes, KPI values |
| `text-primary` | `#E8E8E0` | Títulos de seção, nomes de assessor |
| `text-secondary` | `#A0A090` | Descrições, subtítulos, contexto |
| `text-muted` | `#5C5C50` | Labels de eixo, metadata, hints, `cod_assessor` |
| `text-data` | `#C8C8BC` | Valores em tabelas, eixos, `font-data` |

### Cores — Accent (APENAS O DOURADO)
| Token | Valor | Uso |
|---|---|---|
| `accent-primary` | `#FAC017` | A cor da Eurostock — assessor em destaque, barra de meta atingida, série principal, badges de líder, pontos de ativação 1kk |
| `accent-hover` | `#FBD04A` | Hover state do accent |
| `accent-subtle` | `#FAC01715` | Fundos translúcidos — zona ROA acima de 1%, fill de área em captação, background de badge |
| `accent-glow` | `0 0 12px #FAC01740` | Box-shadow em pontos críticos de gráficos, borda do avatar de líder |

### Cores — Dados (Encoding Semântico)
| Token | Valor | Uso |
|---|---|---|
| `data-context` | `#3A3A3060` | Séries de comparação, assessores não em foco, histórico |
| `data-positive` | `#4CAF8060` | Variações positivas em tooltips — NUNCA como cor de categoria |
| `data-negative` | `#E05A4060` | Variações negativas, anomalias, captação negativa — NUNCA como cor de categoria |
| `data-neutral` | `#6060506080` | Dados sem julgamento de valor |
| `data-anomaly-bg` | `#E05A400A` | Fundo de períodos com captação líquida negativa |
| `data-target` | `#FFFFFF30` | Linhas de meta, benchmarks, médias do time |

### Cores — Status (APENAS feedback funcional)
| Token | Valor | Uso |
|---|---|---|
| `status-success` | `#4CAF80` | Atingimento de meta confirmado (≥100%) |
| `status-error` | `#E05A40` | Captação negativa, dado crítico fora de range |
| `status-warning` | `#F0A030` | Assessor abaixo de 80% da meta — zona de atenção |

### Bordas
| Token | Valor | Uso |
|---|---|---|
| `border-default` | `#FFFFFF10` | Contornos padrão de cards e painéis |
| `border-subtle` | `#FFFFFF07` | Separadores internos, linhas de tabela |
| `border-accent` | `#FAC01740` | Borda de elemento em destaque (top 3 ranking) |
| `border-focus` | `#FAC01780` | Focus state em inputs e elementos interativos |

### Tipografia
| Token | Fonte | Uso |
|---|---|---|
| `font-display` | **JetBrains Mono** (Google Fonts) | Números da manchete, KPIs principais, pontuação acumulada |
| `font-editorial` | **Lora** (Google Fonts) | Tooltips narrativos, anotações inline, insights textuais |
| `font-ui` | **DM Sans** (Google Fonts) | Navegação, labels, botões, filtros, nomes de assessor |
| `font-data` | **JetBrains Mono** (Google Fonts) | Valores em tabelas, eixos, `cod_assessor`, percentuais, deltas |

### Geometria
| Token | Valor | Uso |
|---|---|---|
| `radius-card` | `8px` | Cards e painéis de análise |
| `radius-button` | `4px` | Botões — levemente angular, analítico |
| `radius-badge` | `3px` | Badges de cluster, status, líder |
| `radius-tooltip` | `6px` | Tooltips de gráfico |
| `radius-avatar` | `50%` | Avatar do assessor |
| `radius-chart` | `0px` | Área dos gráficos — reto, frieza analítica |

### Sombras
| Token | Valor | Uso |
|---|---|---|
| `shadow-card` | `0 1px 3px rgba(0,0,0,0.4)` | Cards e painéis |
| `shadow-float` | `0 8px 32px rgba(0,0,0,0.6)` | Tooltips, sheets, dropdowns |
| `shadow-focus` | `0 0 0 2px #FAC01740` | Focus ring em elementos interativos |
| `shadow-accent` | `0 0 12px #FAC01730` | Destaque em pontos críticos de gráficos |

### Dimensões de Gráfico
| Token | Valor | Uso |
|---|---|---|
| `chart-height-hero` | `320px` | Gráfico de captação mensal (principal) |
| `chart-height-context` | `220px` | Treemap de receita, dot plot de ROA |
| `chart-height-spark` | `48px` | Sparklines no card individual |
| `chart-stroke-primary` | `2.5px` | Linha do assessor em foco / série principal |
| `chart-stroke-context` | `1px` | Linhas de outros assessores / contexto |
| `chart-dot-size` | `6px` | Pontos de dado em dot plot |
| `chart-annotation-opacity` | `0.65` | Opacidade de linhas e labels de anotação |

---

## COMPONENTES SHADCN — OVERRIDES

| Componente | Override (usando tokens) |
|---|---|
| `<Card>` | `surface-card`, `border-default`, `radius-card`, `shadow-card` |
| `<Button>` | `accent-primary` background, `surface-card` text, `radius-button`, hover em `accent-hover` |
| `<Badge>` | `surface-elevated` background, `text-secondary`, `radius-badge` — variant dourado para líder: `accent-subtle` bg + `accent-primary` text |
| `<Avatar>` | `radius-avatar`, borda `accent-primary` 2px se `lider = true`, placeholder com iniciais em `font-ui` |
| `<Table>` | `font-data` para valores, `border-subtle` entre rows, hover row em `surface-elevated`, header em `text-muted font-ui` |
| `<Sheet>` | `surface-card` background, `shadow-float`, `border-default` na borda esquerda |
| `<Select>` | `surface-elevated` background, `border-default`, focus em `border-focus`, `font-ui` |
| `<Tabs>` | Aba ativa: `text-headline` + borda inferior `accent-primary` 2px. Inativa: `text-muted`. Background: sem fundo de aba. |
| `<Skeleton>` | Shimmer de `surface-card` para `surface-elevated` com toque de `accent-subtle` — ritmo 1.5s |

---

## PADRÕES DE ANOTAÇÃO ESPECÍFICOS

### Meta de Receita
Quando `receita_total` é comparado com `meta_receita`:
- Linha vertical em `data-target` no ponto da meta no eixo X do bullet chart
- Label acima: "Meta" em `font-data text-muted` tamanho 10px
- Se atingido (≥100%): fill do bullet em `accent-primary`, percentual em `accent-primary font-data`
- Se abaixo de 80%: fill em `data-negative` translúcido, percentual em `data-negative font-data`
- Se entre 80-99%: fill em `data-neutral`, percentual em `text-secondary`

### Ativação 1kk
Quando `ativacao_1kk > 0` em qualquer assessor do mês:
- No card do assessor: marcador especial — losango dourado 8px ao lado do nome
- No ranking: linha do assessor recebe espessura adicional (3px ao invés de 2.5px)
- No tooltip: linha extra em `font-editorial accent-primary`: "★ Ativação de 1M+ neste mês"

### Cluster no Ranking
- Cluster A: sem marcador especial — a posição no ranking já comunica
- Cluster B: leve redução de opacidade no nome (80%) no ranking geral — contexto, não destaque
- Cluster C: opacidade 60% — ainda visível, mas hierarquicamente inferior

### Liderança
- `lider = true`: traço vertical dourado de 2px à esquerda do nome no ranking (como indicador de status editorial, não ícone)
- Badge "Líder" em `accent-subtle` background + `accent-primary` text, `radius-badge`, `font-data` tamanho 10px

---

## QUERIES SUPABASE — REFERÊNCIA PARA A IA QUE IMPLEMENTA

A IA que implementa deve buscar dados da view `mv_resumo_assessor`. Padrões de query:

**Ranking YTD (mês atual):**
Filtrar por `data_posicao` do mês mais recente disponível. Ordenar por `pontos_totais_acumulado` DESC. Incluir todos os campos de identificação + pontuação.

**Comparação mês anterior:**
Buscar o mesmo assessor com `data_posicao` do mês anterior para calcular deltas. A `chave_data_assessor` é a chave para joins temporais.

**Série temporal (últimos 12 meses):**
Filtrar por `cod_assessor` específico e `data_posicao` nos últimos 12 meses. Ordenar por `data_posicao` ASC.

**Visão de time:**
Filtrar por `time`. Agregar `receita_total`, `captacao_liquida_total`, `custodia_net` com SUM. ROA médio com AVG.

**Sem paginação pesada:** a view já é materializada — queries diretas com filtros de `data_posicao` e `time` são rápidas o suficiente para render síncrono na maioria dos casos.

---

## REGRA DE OURO

Ao criar qualquer tela, painel ou gráfico deste dashboard:

1. A interface age como um **gestor de assessores sênior** — ela já fez a análise. Quem abre o dashboard recebe julgamentos, não dados brutos
2. **`#FAC017` é a ÚNICA cor vibrante**. Tudo que é contexto, histórico ou secundário é cinza. O dourado é reservado para o que importa: o assessor em destaque, a meta atingida, o evento raro
3. Todo gráfico principal tem pelo menos **UMA anotação editorial** — meta tracejada, anomalia marcada, evento nomeado, ou ponto de destaque identificado
4. **Tooltips são narrativos** — nunca apenas o valor. Sempre com delta vs. mês anterior, posição no ranking, e quando possível uma linha interpretativa em `font-editorial`
5. A **manchete editorial precede os gráficos** — o gestor sabe o estado geral antes de ver os detalhes
6. **NUNCA Recharts, Chart.js, Victory** — usar Visx + Observable Plot como definido neste documento
7. **Tokens semânticos em tudo** — nenhum valor hardcoded no código
8. **O cluster e a liderança são encoding, não decoração** — aparecem no momento certo, com o peso certo
9. *"Cada número já traz seu veredicto — o gestor age, não interpreta."*

## Teste Final

Coloque o dashboard ao lado de um dashboard Recharts genérico com os mesmos dados. A diferença deve ser óbvia em QUATRO níveis:

- **ESTRUTURA:** manchete editorial → contexto → detalhe. O gestor sabe o estado do time antes de ver qualquer gráfico
- **LINGUAGEM:** dourado único sobre dark. Tipografia analítica com hierarquia de pesos. Sem arco-íris de categorias
- **ANATOMIA:** cada gráfico tem anotações, encoding semântico e hierarquia interna. Tooltips narrativos com delta e julgamento
- **RITMO:** o ranking de YTD conta uma história de evolução, não apenas uma lista. A captação mostra fluxo, não apenas valor. O ROA mostra eficiência relativa, não apenas número absoluto

Se o gestor precisar calcular mentalmente se um assessor está acima ou abaixo da meta → **FALHOU.**
Se todos os assessores tiverem o mesmo peso visual no ranking → **FALHOU.**
Se os tooltips mostrarem apenas o valor sem delta e contexto → **FALHOU.**
Se houver mais de uma cor vibrante na interface → **FALHOU.**
