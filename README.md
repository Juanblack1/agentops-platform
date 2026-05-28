# AgentOps Platform

Projeto de portfólio para treinar a stack da vaga de Desenvolvedor Backend Sênior com Node.js, TypeScript e IA agêntica.

O objetivo é construir uma mini plataforma corporativa de IA com agentes, RAG, auditoria, governança, gateway LLM e caminho claro para Azure.

## O que este primeiro corte entrega

- Backend Node.js/TypeScript com Fastify.
- Catálogo de agentes corporativos e registry Mastra.
- RAG local com chunking, embeddings determinísticos e opção de Qdrant.
- Gateway LLM com modo `mock` e adapter para LiteLLM.
- Workflows de triagem, auditoria e eventos internos.
- Avaliacao automatica de execucoes com scores de RAG, grounding, seguranca e utilidade.
- Fila human-in-the-loop para aprovar ou rejeitar respostas de alto risco.
- Persistencia local em JSON atomico com `DATA_STORE=file`.
- Snapshot operacional para backup em `/api/admin/snapshot`.
- Outbox de eventos com dispatch local em `/api/outbox/dispatch`.
- Storage bruto de documentos em disco local ou Azure Blob.
- Frontend React para operar tickets, documentos, agentes e auditoria.
- Docker Compose para PostgreSQL, Qdrant e LiteLLM opcional.
- Azure Container Registry, manifests Kubernetes e pipeline Azure DevOps.
- Adapter serverless para demo na Vercel sem depender de Azure ligado.
- Documentação SDD e guia Azure passo a passo.

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

A UI aceita `.txt` e `.md` na aba RAG. Via API:

```powershell
curl -X POST "http://localhost:3333/api/documents/upload?classification=internal&tags=runbook,ti" -F "file=@runbook.md"
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
.\infra\azure\export-backend-env.ps1 -ResourceGroupName rg-agentops-dev
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

Para parar o PostgreSQL quando nao estiver usando:

```powershell
npm run azure:stop-postgres
```

Para apagar o ambiente Azure de desenvolvimento e evitar custo recorrente:

```powershell
npm run azure:destroy-dev
```

## Deploy Vercel sem custo Azure

O projeto inclui `vercel.json` e `api/index.ts` para rodar a UI React e a API Fastify como funcoes serverless na Vercel. Por padrao esse modo usa:

```txt
DATA_STORE=memory
LLM_PROVIDER=mock
VECTOR_STORE=memory
OUTBOX_PUBLISHER=local
```

Assim a demo online funciona sem manter PostgreSQL, Service Bus ou Blob Storage ligados no Azure.

```powershell
npm run vercel:deploy
```

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

## História para entrevista

Este projeto foi desenhado para você conseguir explicar decisões de arquitetura: separação por portas/adapters, fallback local para desenvolvimento, gateway multi-LLM com LiteLLM, RAG com Qdrant, persistência local/PostgreSQL, outbox com Azure Service Bus, RBAC, upload de documentos, governança, avaliação de agentes, aprovação humana e trilha de auditoria, além de um caminho realista para Azure.
