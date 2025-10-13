# Sistema de Gestão de Peso para Subatividades

## Visão Geral
Este sistema permite gerenciar pesos de subatividades com cálculo automático via IA através de integração com n8n.

## Funcionalidades Implementadas

### ✅ Concluído
1. **Campo peso na base de dados** - Adicionado campo `peso` na tabela `projects_subactivities`
2. **Interface de criação** - Campos peso e descrição_peso no modal de criação
3. **Exibição visual** - Peso exibido ao lado do nome da subatividade
4. **Botão "Calcular com IA"** - Botão azul ao lado do botão "Concluir"
5. **Lógica de filtro** - Filtra automaticamente subatividades com peso = 0
6. **Integração n8n** - Preparado para integração real com fallback para simulação

## Configuração Necessária

### 1. Aplicar Migração SQL
Execute o seguinte SQL no painel do Supabase (SQL Editor):

```sql
-- Migração para adicionar campo 'peso' na tabela projects_subactivities
ALTER TABLE public.projects_subactivities 
ADD COLUMN peso INTEGER NOT NULL DEFAULT 0;

-- Comentário explicativo sobre o campo
COMMENT ON COLUMN public.projects_subactivities.peso IS 'Peso da subatividade. Valor 0 indica que deve ser calculado com IA';
```

### 2. Configurar Endpoint n8n
No arquivo `.env`, configure a URL do seu webhook n8n:

```env
VITE_N8N_WEBHOOK_URL="https://sua-instancia-n8n.com/webhook/calculate-weights"
```

### 3. Formato Esperado do n8n

#### Request (enviado para n8n):
```json
{
  "subactivities": [
    {
      "id": "uuid-da-subatividade",
      "title": "Nome da subatividade",
      "description": "Descrição ou comentário"
    }
  ],
  "project_id": "uuid-do-projeto"
}
```

#### Response (esperado do n8n):
```json
{
  "weights": [
    {
      "id": "uuid-da-subatividade",
      "peso": 5
    }
  ]
}
```

## Como Usar

### 1. Criar Subatividade
- Abra uma atividade
- Clique em "Adicionar" no checklist
- Preencha o título
- Configure o peso (0 = calcular com IA)
- Adicione descrição do peso (opcional, apenas informativa)

### 2. Calcular Pesos com IA
- Clique no botão azul "Calcular com IA" ao lado de "Concluir"
- O sistema filtra subatividades com peso = 0
- Envia dados para o n8n
- Atualiza os pesos no banco de dados
- Recarrega a interface

### 3. Visualizar Pesos
- Os pesos aparecem como badges azuis ao lado do nome da subatividade
- Formato: "Peso: X"

## Fallback e Simulação
- Se o endpoint n8n não estiver configurado ou falhar, o sistema usa simulação
- Pesos aleatórios entre 1-10 são atribuídos
- Toast de aviso informa sobre o uso da simulação

## Estrutura de Arquivos Modificados

### Frontend
- `src/pages/ProjectActivities.tsx` - Interface principal
- `src/types/index.ts` - Tipos TypeScript atualizados

### Backend
- `supabase/migrations/20241212_add_peso_to_subactivities.sql` - Migração SQL

### Configuração
- `.env` - Variável de ambiente para n8n
- `PESO_MANAGEMENT_SETUP.md` - Este arquivo de documentação

## Próximos Passos
1. Aplicar a migração SQL no Supabase
2. Configurar instância n8n com webhook
3. Testar funcionalidade completa
4. Ajustar algoritmo de IA conforme necessário

## Troubleshooting

### Erro "Formato de resposta inválido do n8n"
- Verifique se o n8n retorna o formato JSON correto
- Confirme que `response.weights` é um array

### Simulação sempre ativa
- Verifique a variável `VITE_N8N_WEBHOOK_URL` no .env
- Confirme que o endpoint n8n está acessível
- Verifique logs do console para erros de rede

### Pesos não aparecem
- Confirme que a migração SQL foi aplicada
- Verifique se os tipos TypeScript estão atualizados
- Recarregue a página após aplicar a migração