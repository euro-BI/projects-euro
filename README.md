# Hub - Eurostock

Sistema moderno Hub - Eurostock desenvolvido com React e Vite, integrando análise de dados via Power BI e assistência inteligente via Chatbot.

## 🚀 Funcionalidades Principais

### 📊 Integração com Power BI
- **Dashboards Embarcados**: Visualização de relatórios e workspaces do Power BI diretamente na aplicação.
- **Autenticação Segura**: Gerenciamento de tokens via Service Principal (Azure AD).
- **Controles de Visualização**: Ajuste dinâmico de layout (Ajustar à página, Largura, Tamanho real).

### 🤖 Smart Chat (Assistente IA)
- **Chatbot Inteligente**: Interface de chat conectada via Webhook (n8n) para processamento de linguagem natural.
- **Suporte a Multimídia**: Envio de mensagens de texto e **gravação de áudio** (mensagens de voz).
- **Interface Responsiva**: Design fluido com animações (Framer Motion).

### 🔐 Autenticação e Segurança
- **Supabase Auth**: Sistema completo de login e registro de usuários.
- **Proteção de Rotas**: Controle de acesso para páginas privadas.

### 📱 Experiência do Usuário (UX)
- **PWA (Progressive Web App)**: Instalável como aplicativo nativo.
- **Design Moderno**: Interface construída com Shadcn/ui e Tailwind CSS.
- **Responsividade**: Totalmente adaptável para desktop e mobile.

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React, TypeScript, Vite
- **Estilização**: Tailwind CSS, Shadcn/ui
- **Dados & Backend**: Supabase (Auth/DB), TanStack Query
- **Integrações**:
  - `powerbi-client-react`: SDK para embed do Power BI.
  - Webhooks (n8n): Para lógica do Chatbot.
- **Bibliotecas**: Framer Motion (animações), Lucide React (ícones), Axios.

## ⚙️ Configuração

Para rodar o projeto, crie um arquivo `.env` na raiz com as seguintes variáveis:

```env
# Configurações do Power BI (Azure AD)
VITE_MSAL_TENANT_ID=seu-tenant-id
VITE_MSAL_CLIENT_ID=seu-client-id
VITE_MSAL_CLIENT_SECRET=seu-client-secret

# Configurações do Supabase
VITE_SUPABASE_URL=sua-url-do-supabase
VITE_SUPABASE_ANON_KEY=sua-chave-anon

# Configurações Gerais
VITE_API_URL=http://localhost:8080
```

## 📦 Instalação e Execução

1. Instale as dependências:
```bash
npm install
```

2. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

3. Acesse a aplicação em `http://localhost:8080` (ou a porta indicada no terminal).
