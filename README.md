# 📦 Painel de Compras — Bling Dashboard

Dashboard automatizado para gestão de compras, integrado com a API v3 do Bling ERP.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![Bling API](https://img.shields.io/badge/Bling-API%20v3-blue) ![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)

## O que esse painel faz

- **Visão geral**: KPIs de gastos totais, ticket médio, pedidos em aberto e alertas de estoque baixo
- **Gráficos**: Gastos por fornecedor, evolução mensal, distribuição de status
- **Pedidos de compra**: Tabela completa com filtros por fornecedor, status e período
- **Estoque**: Saldos físico e virtual com alertas de reposição

---

## Passo a Passo para Configurar

### 1. Criar o repositório no GitHub

1. Acesse [github.com/new](https://github.com/new)
2. Nome do repositório: `bling-dashboard`
3. Marque como **Private** (recomendado, pois terá dados da sua empresa)
4. Clique em **Create repository**
5. Não precisa marcar README nem .gitignore (já temos)

### 2. Subir os arquivos para o GitHub

No seu computador, abra o terminal (ou Git Bash no Windows) na pasta do projeto e execute:

```bash
cd bling-dashboard
git init
git add .
git commit -m "Primeiro commit - Painel de Compras Bling"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/bling-dashboard.git
git push -u origin main
```

> **Dica**: Substitua `SEU_USUARIO` pelo seu nome de usuário do GitHub.

### 3. Configurar o aplicativo no Bling

1. Acesse o Bling → **Central de Extensões** → **Área do Integrador**
   (ou vá direto: `https://www.bling.com.br/cadastro.aplicativos.php`)
2. Se já tem o app criado, anote o **Client ID** e **Client Secret**
3. Na **URL de Redirecionamento**, adicione:
   - Para desenvolvimento: `http://localhost:3000/api/auth/callback`
   - Para produção: `https://seu-dominio.vercel.app/api/auth/callback`
4. Nos **Escopos**, certifique-se de ter habilitado:
   - Pedidos de Compra
   - Produtos
   - Controle de Estoque
   - Clientes e Fornecedores

### 4. Deploy na Vercel

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Clique em **Import Git Repository**
3. Selecione o repositório `bling-dashboard`
4. Na tela de configuração, em **Environment Variables**, adicione:

| Variável | Valor |
|---|---|
| `BLING_CLIENT_ID` | Seu Client ID do app Bling |
| `BLING_CLIENT_SECRET` | Seu Client Secret do app Bling |
| `BLING_REDIRECT_URI` | `https://seu-dominio.vercel.app/api/auth/callback` |

5. Clique em **Deploy**
6. Após o deploy, copie a URL gerada (ex: `bling-dashboard-abc123.vercel.app`)
7. **IMPORTANTE**: Volte ao Bling e atualize a URL de redirecionamento com essa URL

### 5. Primeiro acesso

1. Acesse o painel pela URL da Vercel
2. Clique em **Conectar com Bling**
3. Faça login na sua conta do Bling e autorize o aplicativo
4. Pronto! O painel carregará seus dados automaticamente

---

## Desenvolvimento local

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais

# Rodar em modo desenvolvimento
npm run dev
```

Acesse `http://localhost:3000`

---

## Estrutura do Projeto

```
bling-dashboard/
├── app/
│   ├── api/
│   │   ├── auth/          # Login OAuth e callback
│   │   ├── purchases/     # Proxy para pedidos de compra
│   │   ├── products/      # Proxy para produtos
│   │   └── stock/         # Proxy para estoque
│   ├── globals.css        # Estilos globais
│   ├── layout.js          # Layout raiz
│   └── page.js            # Dashboard principal
├── lib/
│   └── bling.js           # Cliente da API Bling
├── .env.example           # Template de variáveis
├── next.config.js
├── tailwind.config.js
└── package.json
```

## Notas Importantes

- **Tokens**: O access_token do Bling expira a cada 6 horas. O sistema faz refresh automático.
- **Limites da API**: O Bling tem rate limit. O painel busca até 100 registros por página.
- **Segurança**: Nunca compartilhe suas credenciais. Use variáveis de ambiente.
- **Dados**: Os dados são somente leitura — o painel não altera nada no seu Bling.
