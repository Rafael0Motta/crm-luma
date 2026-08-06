# CRM Luma Benefícios

CRM conversacional para a Luma Benefícios (corretora de seguros): atendimento via WhatsApp centralizado, funil de vendas, automações, follow-ups, mensagens agendadas e lembretes de cobrança recorrente.

## Stack

- **Backend**: Node.js + TypeScript + Express + Prisma (PostgreSQL) + BullMQ (Redis)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **WhatsApp**: Evolution API (self-hosted, referenciada via variáveis de ambiente)
- **IA**: provedor configurável pelo painel (OpenAI, Anthropic ou qualquer API REST compatível), chave de API armazenada criptografada no banco
- **Autenticação**: JWT com papéis `ADMIN` / `ATENDENTE`

## Estrutura

```
backend/    API REST, workers (BullMQ) e schema Prisma
frontend/   Aplicação React (SPA)
docker-compose.yml   Orquestra backend, worker, redis e frontend na VPS
```

O PostgreSQL e a Evolution API **já existem na VPS do cliente** e não são criados pelo `docker-compose.yml` — apenas referenciados via variáveis de ambiente.

## Configuração local

### 1. Backend

```bash
cd backend
cp .env.example .env   # preencha com os valores reais (nunca commite o .env)
npm install
npx prisma migrate dev   # cria as tabelas no Postgres configurado em DATABASE_URL
npm run seed              # cria plano padrão, etapas de funil e usuário admin inicial
npm run dev                # API em http://localhost:3333
```

Em outro terminal, para rodar os workers (follow-ups, mensagens agendadas, lembretes de cobrança):

```bash
cd backend
npm run worker
```

Variáveis obrigatórias em `backend/.env` (veja `backend/.env.example`):

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string do Postgres já existente na VPS |
| `REDIS_URL` | Redis usado pelas filas (BullMQ) |
| `JWT_SECRET` | Segredo para assinatura dos tokens |
| `ENCRYPTION_KEY` | Chave hex de 32 bytes para criptografar a API key de IA no banco (`openssl rand -hex 32`) |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE_NAME` | Credenciais da Evolution API já hospedada na VPS |
| `APP_BASE_URL` | URL pública desta aplicação |
| `CORS_ORIGIN` | Origem(ns) do frontend permitidas pelo CORS |

A configuração do provedor de IA (OpenAI, Anthropic ou outro) é feita **pela tela de Configurações do painel**, não por variável de ambiente.

### 2. Frontend

```bash
cd frontend
cp .env.example .env   # ajuste VITE_API_URL se necessário
npm install
npm run dev             # http://localhost:5173
```

Usuário administrador padrão criado pelo seed: `admin@lumabeneficios.com.br` / `TrocarSenha123!` — troque a senha assim que possível.

## Webhook da Evolution API

Configure na Evolution API o webhook apontando para:

```
POST {APP_BASE_URL}/webhooks/evolution
```

O endpoint processa eventos de mensagem recebida (`messages.upsert`), atualização de status de entrega (`messages.update`) e atualização de conexão (`connection.update`), disparando automaticamente o motor de automações e cancelando follow-ups pendentes quando o cliente responde.

## Deploy (Docker Compose na VPS)

```bash
cp backend/.env.example backend/.env   # preencha com os valores de produção
docker compose build
docker compose up -d
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run seed   # opcional, apenas no primeiro deploy
```

Serviços subidos pelo compose:

- `backend` — API REST (porta 3333)
- `worker` — processa as filas de follow-up, mensagens agendadas e lembretes de cobrança
- `redis` — fila/cache (BullMQ)
- `frontend` — SPA servida via Nginx (porta 8080)

O Postgres e a Evolution API continuam rodando fora do compose, na VPS do cliente.

## Segurança

- A chave de API de IA é armazenada **criptografada** (AES-256-GCM) no banco e nunca é retornada em texto puro pela API — apenas uma versão mascarada.
- Nunca commite arquivos `.env`. Use sempre `.env.example` como referência.
- Falhas de envio pela Evolution API ficam visíveis nas mensagens/lembretes correspondentes (não silenciosas).
