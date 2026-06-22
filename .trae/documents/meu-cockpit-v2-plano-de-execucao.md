## 1. Objetivo do Plano
Este plano descreve o passo a passo detalhado para construir o `Meu Cockpit V2` em rota nova, reaproveitando a base funcional do cockpit atual e aproximando a experiência visual da referência aprovada.

## 2. Estratégia Geral
- Implementar a V2 em paralelo à V1, sem regressão no cockpit atual.
- Primeiro validar dados e arquitetura.
- Depois montar a estrutura visual.
- Em seguida preencher blocos por prioridade.
- Por fim, lapidar interações, responsividade e performance.

## 3. Macroetapas

### 3.1 Etapa 0 — Descoberta e saneamento de escopo
**Objetivo**
- Traduzir a referência visual em blocos reais de produto e eliminar duplicidades.

**Tarefas**
1. Listar todos os cards, blocos e gráficos da imagem de referência.
2. Marcar o que é bloco principal, bloco secundário e bloco repetido.
3. Validar com regra de negócio quais indicadores devem continuar e quais devem ser consolidados.
4. Confirmar quais campos existem de fato na base atual.

**Saída esperada**
- Matriz `bloco visual x fonte de dados x status`.

### 3.2 Etapa 1 — Estrutura técnica da V2
**Objetivo**
- Criar a base técnica da nova tela sem tocar na V1.

**Tarefas**
1. Criar nova rota `/dash/meu-cockpit-v2`.
2. Criar página `AssessorCockpitV2.tsx`.
3. Criar pasta de componentes `src/components/cockpit-v2`.
4. Criar hook `useAssessorCockpitV2Data`.
5. Criar mapper `cockpit-v2-mappers.ts`.
6. Adicionar card de acesso na home somente se desejado nesta fase.

**Critério de pronto**
- A rota nova abre com shell e dados mockados ou placeholders.

### 3.3 Etapa 2 — Dados, filtros e permissões
**Objetivo**
- Garantir que a V2 respeita o mesmo escopo de acesso do cockpit atual.

**Tarefas**
1. Reaproveitar lógica de `user`, `lider`, `admin` e `admin_master`.
2. Reaproveitar a carga de filtros de ano, mês, time e assessor.
3. Reaproveitar a resolução do time do líder.
4. Reaproveitar a leitura de data de referência.
5. Persistir filtros em sessão, como já acontece na V1.

**Critério de pronto**
- O usuário certo vê o assessor certo e os filtros funcionam.

### 3.4 Etapa 3 — Extração de regras de negócio da V1
**Objetivo**
- Tirar os cálculos do componente legado e transformá-los em base reutilizável.

**Tarefas**
1. Extrair cálculo de `performance global`.
2. Extrair cálculo de `investimentos`.
3. Extrair cálculo de `cross-sell`.
4. Extrair cálculo de `captação líquida`.
5. Extrair cálculo de `evolução da receita`.
6. Mapear o que é `meta original`, `meta proporcional` e `pace`.
7. Criar testes unitários para os mappers críticos.

**Critério de pronto**
- A V2 consegue receber um payload pronto para UI sem lógica pesada no JSX.

### 3.5 Etapa 4 — Shell visual premium
**Objetivo**
- Aprovar a cara geral da V2 antes de preencher tudo.

**Tarefas**
1. Implementar fundo e grid principal.
2. Implementar sidebar compacta.
3. Implementar header executivo.
4. Implementar containers dos blocos principais.
5. Refinar tokens visuais da V2: cores, espaçamento, bordas e brilho.

**Critério de pronto**
- A página já “parece produto” antes dos dados finais.

### 3.6 Etapa 5 — Bloco de identidade e ranking
**Objetivo**
- Construir a abertura narrativa da tela.

**Tarefas**
1. Criar `AdvisorHero`.
2. Criar `RankingStrip`.
3. Exibir nome, código, time, foto, ano e contexto.
4. Exibir posição no ranking, pontuação e total de assessores.
5. Adicionar estado visual de destaque quando o dado existir.

**Critério de pronto**
- O topo da tela comunica claramente quem é o assessor e como ele está no ranking.

### 3.7 Etapa 6 — Faixa de KPIs rápidos
**Objetivo**
- Entregar leitura de topo em poucos segundos.

**Tarefas**
1. Construir componente genérico de KPI compacto.
2. Exibir `clientes ativos`.
3. Exibir `receita total`.
4. Exibir `custódia`.
5. Exibir `captação líquida`.
6. Exibir `ativações` somente se houver dado confiável.
7. Definir hierarquia visual para valores, subtítulos e metas.

**Critério de pronto**
- O topo do dashboard oferece leitura rápida sem poluição.

### 3.8 Etapa 7 — Blocos analíticos centrais
**Objetivo**
- Construir o miolo da performance comercial.

**Tarefas**
1. Implementar `PerformanceGauge`.
2. Implementar card de `Investimentos`.
3. Implementar card de `Cross-sell`.
4. Implementar card de `Captação Líquida`.
5. Exibir meta, realizado, gap e percentual.
6. Adicionar breakdown por produto onde fizer sentido.

**Critério de pronto**
- A tela já permite entender performance consolidada e por eixo.

### 3.9 Etapa 8 — Gráficos e narrativa de evolução
**Objetivo**
- Mostrar tendência, e não só fotografia.

**Tarefas**
1. Criar gráfico de `Evolução da Receita`.
2. Criar gráfico de `Análise de Captação`.
3. Implementar tooltips customizados.
4. Destacar melhor mês, mês atual e gap para meta.
5. Se possível, permitir clique para modal narrativo.

**Critério de pronto**
- A tela passa a responder “como estou evoluindo?”.

### 3.10 Etapa 9 — Tabela consolidada final
**Objetivo**
- Entregar uma camada auditável e operacional.

**Tarefas**
1. Construir tabela final com cabeçalho sticky.
2. Exibir colunas auditáveis do assessor e do período.
3. Adicionar cores semânticas e formatação monetária.
4. Permitir exportação para Excel.
5. Ajustar leitura horizontal e responsividade.

**Critério de pronto**
- O usuário consegue conferir números detalhados sem sair da página.

### 3.11 Etapa 10 — Interações e profundidade
**Objetivo**
- Dar sofisticação sem virar ruído.

**Tarefas**
1. Adicionar hover states e microinterações.
2. Adicionar modais de detalhamento nos blocos mais ricos.
3. Adicionar estados vazios e skeletons.
4. Adicionar mensagens contextuais para filtros e ausência de dados.

**Critério de pronto**
- A V2 fica premium, legível e clara.

### 3.12 Etapa 11 — QA, performance e aprovação
**Objetivo**
- Fechar a V2 com segurança.

**Tarefas**
1. Testar acessos por perfil.
2. Testar todos os filtros.
3. Validar métricas com exemplos reais.
4. Validar responsividade.
5. Rodar checks de TypeScript.
6. Validar visualmente com preview.
7. Revisar com o chefe e ajustar as últimas arestas.

**Critério de pronto**
- A V2 fica pronta para homologação real.

## 4. Ordem Recomendada de Implementação
1. Rota nova e shell
2. Hook de dados e mapper
3. Hero e ranking
4. KPIs rápidos
5. Performance global
6. Investimentos
7. Cross-sell
8. Captação líquida
9. Gráficos
10. Tabela consolidada
11. Modais e refinamentos
12. Responsividade e QA

## 5. Dependências por Bloco
| Bloco | Dependência principal |
|------|------------------------|
| Hero do assessor | dados de assessor e filtros ativos |
| Super Ranking | ranking anual consolidado |
| KPIs rápidos | resumo mensal do assessor |
| Performance global | metas e receitas consolidadas |
| Investimentos | breakdown de produtos de investimento |
| Cross-sell | breakdown de produtos de cross-sell |
| Captação líquida | meta de captação + realizado |
| Evolução de receita | histórico mensal |
| Análise de captação | série temporal confiável |
| Tabela consolidada | modelo tabular final e campos auditáveis |

## 6. Riscos e Mitigações
| Risco | Impacto | Mitigação |
|------|---------|-----------|
| Indicador da imagem sem base real | Alto | substituir por bloco equivalente auditável |
| Página ficar monolítica como a V1 | Alto | componentizar desde o primeiro commit |
| Duplicação visual de métricas | Médio | consolidar narrativa antes da implementação |
| Regressão no cockpit atual | Alto | manter rota separada e reaproveitamento controlado |
| Baixa performance por excesso de cálculo em render | Médio | usar hook + mapper + memoização |

## 7. Checklist de Validação Funcional
- A V2 abre em rota separada
- O cockpit legado continua intacto
- Os filtros respeitam o perfil do usuário
- Os cálculos batem com a V1 onde a regra é a mesma
- Os blocos visuais não duplicam métricas sem motivo
- Todos os cards relevantes têm fonte auditável
- A tabela final fecha com os números dos cards
- A experiência desktop fica premium e clara

## 8. Próxima Decisão Necessária Antes da Implementação
- Confirmar o inventário dos indicadores do anexo que de fato entram na primeira versão:
  - `ativações`
  - `fluxo de entrada`
  - `fluxo de saída`
  - `repasse total`
  - `ROA invest`
  - `ROA cs`
- Se algum deles não tiver base clara agora, ele deve ir para `fase 2` da V2, não para a primeira entrega.
