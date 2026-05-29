# AgentOps Platform

AgentOps Platform é uma plataforma corporativa de IA agêntica para operar agentes, documentos RAG, tickets, aprovações humanas, auditoria e eventos de integração em um único painel.

O projeto roda localmente sem chaves externas usando LLM mock, embeddings determinísticos e persistência em arquivo. Quando necessário, os mesmos contratos podem ser ligados a LiteLLM, Qdrant, PostgreSQL, Azure Blob Storage, Azure Service Bus, Kubernetes e Azure DevOps.

## Principais recursos

- API Node.js/TypeScript com Fastify e separação por adapters.
- Catálogo de agentes corporativos com Mastra, tools e workflow executável no Mastra Studio.
- RAG com chunking, embeddings locais e suporte opcional a Qdrant ou PostgreSQL/pgvector.
- Gateway LLM com modo `mock`, adapter LiteLLM e Google Gemini via Vercel AI SDK.
- Workflows de triagem de tickets, aprovações humanas, auditoria e rastreamento por `traceId`.
- Avaliação automática de execuções com scores de RAG, grounding, segurança e utilidade.
- Outbox para entrega assíncrona de eventos, com modo local ou Azure Service Bus.
- Upload de documentos com storage local ou Azure Blob Storage.
- Dashboard React para documentos, tickets, agentes, aprovações, auditoria e arquitetura Azure.
- Infraestrutura com Docker Compose, Bicep, manifests Kubernetes, Azure DevOps e deploy serverless na Vercel.

## Como rodar localmente

1. Entre na pasta do projeto:

```powershell
cd "c:\Users\veron\OneDrive\Área de Trabalho\MeuSquadProtagonista\Projetos\agentops-platform"
```

2. Instale as dependências:

```powershell
npm install
```

3. Copie o arquivo de exemplo de ambiente:

```powershell
Copy-Item .env.example backend/.env
Copy-Item .env.example frontend/.env
```

4. Rode backend e frontend:

```powershell
npm run dev
```

5. Acesse:

- Frontend: http://localhost:5173
- Backend health: http://localhost:3333/health
- Swagger: http://localhost:3333/docs

O modo padrão é `LLM_PROVIDER=mock`, então você não precisa configurar chaves de IA para começar.

Por padrão o backend grava dados em `data/agentops-store.json`. Se quiser rodar sem persistência, altere `backend/.env`:

```env
DATA_STORE=memory
```

Para exportar um backup lógico:

```powershell
Invoke-RestMethod -Uri http://localhost:3333/api/admin/snapshot | ConvertTo-Json -Depth 20
```

Para simular entrega assíncrona dos eventos pendentes:

```powershell
Invoke-RestMethod -Uri http://localhost:3333/api/outbox/dispatch -Method Post -ContentType 'application/json' -Body '{"limit":25}'
```

## Como ligar PostgreSQL e Qdrant local

```powershell
npm run docker:up
```

Para usar PostgreSQL no backend, altere `backend/.env`:

```env
DATA_STORE=postgres
POSTGRES_URL=postgres://agentops:agentops@localhost:5432/agentops
```

Rode a migration explicitamente, ou deixe o backend aplicar no boot:

```powershell
npm run db:migrate
```

Para usar Qdrant, altere `backend/.env`:

```env
VECTOR_STORE=qdrant
QDRANT_URL=http://localhost:6333
```

Para usar PostgreSQL como vector store com pgvector:

```env
DATA_STORE=postgres
VECTOR_STORE=pgvector
POSTGRES_URL=postgres://agentops:agentops@localhost:5432/agentops
```

Depois rode:

```powershell
$env:VECTOR_STORE="pgvector"
npm run db:migrate
```

## Como ligar Gemini pelo Vercel AI SDK

Crie uma chave no Google AI Studio e configure somente no seu `.env` local ou nas variáveis da Vercel. Não coloque a chave no README nem no código.

```env
LLM_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=<sua-chave-google-ai-studio>
GOOGLE_GENERATIVE_AI_MODEL=gemini-2.5-flash
```

Em producao, o backend exige uma chave da propria plataforma quando `LLM_PROVIDER` nao for `mock`. A chave do Google fica somente no backend/Vercel e nunca deve ser colocada no frontend. A UI tem um campo de chave de acesso para operadores, revisores e administradores.

## Mastra Studio

O projeto registra agentes, tools e workflow no Mastra. Rode a API Mastra:

```powershell
npm run mastra:dev
```

Em outro terminal, rode o Studio:

```powershell
npm run mastra:studio
```

URLs padrão:

- Mastra API: http://localhost:4111
- Mastra Studio: http://localhost:3001

O runtime Fastify continua responsável por RAG persistente, RBAC, auditoria, outbox e APIs da UI.

## Como configurar RBAC por API key

No `backend/.env`:

```env
API_KEYS=operator:dev-operator-key,reviewer:dev-reviewer-key,admin:dev-admin-key
```

Depois envie `x-api-key` nas chamadas. Roles:

- `operator`: cria tickets, documentos e executa agentes.
- `reviewer`: tambem decide aprovacoes.
- `admin`: acessa snapshot e dispatch da outbox.

## Como publicar outbox no Azure Service Bus

No `backend/.env`:

```env
OUTBOX_PUBLISHER=servicebus
AZURE_SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://...
AZURE_SERVICE_BUS_TOPIC=agentops-events
```

Depois chame:

```powershell
Invoke-RestMethod -Uri http://localhost:3333/api/outbox/dispatch -Method Post -ContentType 'application/json' -Body '{"limit":25}'
```

## Como fazer upload de documentos

A aba RAG aceita PDF, DOCX, XLSX, TXT, Markdown, CSV/TSV, JSON/JSONL, YAML/YML, XML, HTML, LOG, CONF, INI e SQL. O limite padrao e `UPLOAD_MAX_BYTES=8000000`.

Via API:

```powershell
curl -X POST "http://localhost:3333/api/documents/upload?classification=internal&tags=runbook,ti" -F "file=@runbook.pdf"
```

Por padrao os arquivos brutos ficam em `data/uploads`. Para usar Azure Blob:

```env
DOCUMENT_STORAGE=azure-blob
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=...
AZURE_STORAGE_CONTAINER=agentops-documents
```

## Como provisionar Azure por script

Se o Azure CLI estiver instalado e autenticado:

```powershell
az login
$env:AGENTOPS_POSTGRES_PASSWORD="use-a-strong-password"
.\infra\azure\provision.ps1 -ResourceGroupName rg-agentops-br-dev -Location brazilsouth -NamePrefix agentopsbrdev
```

Veja `infra/azure/README.md`.

Para gerar automaticamente um `.env` local com connection strings do Azure:

```powershell
$env:AGENTOPS_POSTGRES_PASSWORD="use-a-strong-password"
.\infra\azure\export-backend-env.ps1 -ResourceGroupName rg-agentops-br-dev
```

Para buildar e publicar as imagens no Azure Container Registry sem Docker local:

```powershell
.\infra\azure\build-and-push.ps1 -RegistryName <acr-name> -ImageTag dev-001
```

Se a assinatura bloquear ACR Tasks, use o fallback com Docker Desktop:

```powershell
.\infra\azure\docker-build-and-push.ps1 -RegistryName <acr-name> -ImageTag dev-001
```

Para aplicar os manifests em AKS:

```powershell
kubectl apply -k infra/k8s
```

Veja tambem `infra/k8s/README.md`.

## Controle de custo Azure

O ambiente Azure de desenvolvimento fica no resource group `rg-agentops-br-dev`. Para verificar recursos ativos:

```powershell
npm run azure:cost-status
```

Para criar ou atualizar o budget mensal do resource group:

```powershell
npm run azure:create-budget
```

Para parar o PostgreSQL quando nao estiver usando:

```powershell
npm run azure:stop-postgres
```

Para apagar o ambiente Azure de desenvolvimento e evitar custo recorrente:

```powershell
npm run azure:destroy-dev
```

Para preparar pgvector no Azure PostgreSQL, o servidor precisa estar ligado somente durante a janela de configuração/migração:

```powershell
npm run azure:start-postgres
npm run azure:enable-pgvector
$env:VECTOR_STORE="pgvector"
npm run db:migrate
npm run azure:stop-postgres
```

## Azure Container Apps

O alvo de backend em Azure é Container Apps com `minReplicas=0`, mais barato que manter AKS ligado. Depois de publicar a imagem `agentops-backend:<tag>` no ACR:

```powershell
$env:AGENTOPS_API_KEYS="admin:<long-random-key>"
$env:GOOGLE_GENERATIVE_AI_API_KEY="<google-ai-studio-key>"
npm run azure:deploy-container-apps -- -ImageTag dev -LlmProvider google
```

Se não houver imagem no ACR, o script para antes de criar Container Apps.

## Deploy Vercel com backend duravel

O projeto inclui `vercel.json` e `api/index.ts` para rodar a UI React e a API Fastify como funcoes serverless na Vercel. Em producao, configure variaveis reais para:

```txt
DATA_STORE=postgres
DOCUMENT_STORAGE=azure-blob
LLM_PROVIDER=google
VECTOR_STORE=pgvector
OUTBOX_PUBLISHER=servicebus
```

Sem essas variaveis, o deploy ainda pode iniciar com defaults locais, mas nao deve ser considerado ambiente operacional.

```powershell
npm run vercel:deploy
```

## Automacao Vercel SDK e MCP

O projeto inclui automacao com `@vercel/sdk` para atualizar as variaveis de Production sem imprimir secrets:

```powershell
npm run vercel:sync-env
```

Esse comando le `backend/.env`, `backend/.env.local.admin-key`, `.vercel/project.json` e o token ja autenticado pela Vercel CLI. As variaveis sincronizadas sao `LLM_PROVIDER`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GOOGLE_GENERATIVE_AI_MODEL`, `MASTRA_MODEL` e `API_KEYS`.

Para iniciar o MCP local da Vercel via SDK:

```powershell
npm run vercel:mcp
```

Tambem existe `.cursor/mcp.json` apontando para o mesmo launcher. O token nao fica salvo nesse arquivo; o launcher usa `VERCEL_TOKEN` ou o login local da Vercel CLI.

## Google Stitch por OAuth

O projeto inclui `@google/stitch-sdk` e `@_davideast/stitch-mcp` para gerar telas e usar o Stitch via MCP. A chave do Google AI Studio pode listar tools em alguns casos, mas a geracao real de projetos/telas do Stitch exige OAuth2.

Fluxo recomendado:

```powershell
npm run stitch:init
```

Na janela interativa:

1. Selecione `OAuth`.
2. Selecione `Proxy (Recommended for Dev)` quando perguntado sobre conexao.
3. Faca login no navegador com a mesma conta usada no Stitch.
4. Escolha ou configure um Google Cloud project quando o assistente pedir.
5. Autorize a habilitacao da API do Stitch se aparecer esse passo.

Depois valide:

```powershell
npm run stitch:doctor
```

Para iniciar o proxy MCP manualmente:

```powershell
npm run stitch:proxy
```

As skills do Stitch foram instaladas em `~/.codex/skills`, mas o Codex precisa ser reiniciado para carregar essas skills automaticamente.

## Como ligar LiteLLM depois

1. Configure as variáveis de Azure OpenAI ou outro provider no seu ambiente.
2. Suba o perfil opcional do LiteLLM:

```powershell
docker compose --profile llm up -d litellm
```

3. No `backend/.env`, altere:

```env
LLM_PROVIDER=litellm
LITELLM_BASE_URL=http://localhost:4000
LITELLM_API_KEY=local-master-key
LITELLM_MODEL=azure-gpt-4o-mini
```

Veja o passo a passo completo em `docs/azure/azure-step-by-step.md`.

## Estrutura

```txt
agentops-platform/
  backend/        API, agentes, RAG, eventos, auditoria
  frontend/       React dashboard operacional
  docs/           SDD, plano, Azure
  infra/          LiteLLM e manifestos Kubernetes
```
