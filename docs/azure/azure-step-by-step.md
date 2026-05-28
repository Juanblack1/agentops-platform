# Azure - Passo a Passo

Este guia mostra o que você fará fora do código quando quiser transformar o projeto local em uma arquitetura Azure.

## Fase 1 - Azure OpenAI por trás do LiteLLM

1. Crie um recurso Azure OpenAI no portal Azure.
2. Crie um deployment de chat, por exemplo `gpt-4o-mini`.
3. Crie um deployment de embedding, por exemplo `text-embedding-3-small`.
4. Copie o endpoint do recurso Azure OpenAI.
5. Guarde a chave no Azure Key Vault ou, para teste local, em variável de ambiente.
6. Configure:

```powershell
$env:AZURE_OPENAI_ENDPOINT="https://SEU-RECURSO.openai.azure.com"
$env:AZURE_OPENAI_API_KEY="SUA_CHAVE"
$env:AZURE_OPENAI_API_VERSION="2024-10-21"
$env:LITELLM_MASTER_KEY="local-master-key"
docker compose --profile llm up -d litellm
```

7. Altere `backend/.env`:

```env
LLM_PROVIDER=litellm
LITELLM_BASE_URL=http://localhost:4000
LITELLM_API_KEY=local-master-key
LITELLM_MODEL=azure-gpt-4o-mini
```

## Fase 2 - Qdrant

1. Para estudo local, use `docker compose up -d qdrant`.
2. Para cloud, escolha Qdrant Cloud ou rode Qdrant no AKS.
3. Configure:

```env
VECTOR_STORE=qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=agentops_documents
```

## Fase 3 - Serviços Azure corporativos

1. Crie um Azure Container Registry.
2. Crie um Azure Container Apps Environment ou um cluster AKS.
3. Crie um Azure Service Bus Namespace para eventos.
4. Crie uma Storage Account para documentos brutos.
5. Crie Azure Database for PostgreSQL para dados transacionais.
6. Crie Key Vault e mova chaves e connection strings para segredos.
7. Ative Application Insights e Azure Monitor.

Configuracao local equivalente:

```env
DATA_STORE=postgres
POSTGRES_URL=postgres://agentops:agentops@localhost:5432/agentops
OUTBOX_PUBLISHER=servicebus
AZURE_SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://...
AZURE_SERVICE_BUS_TOPIC=agentops-events
DOCUMENT_STORAGE=azure-blob
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=...
AZURE_STORAGE_CONTAINER=agentops-documents
```

Tambem existe um caminho automatizado com Bicep:

```powershell
az login
$env:AGENTOPS_POSTGRES_PASSWORD="use-a-strong-password"
.\infra\azure\provision.ps1 -ResourceGroupName rg-agentops-br-dev -Location brazilsouth -NamePrefix agentopsbrdev
```

## Fase 3.1 - Human-in-the-loop e avaliacoes

1. Troque o `PersistentStore` local por um adapter PostgreSQL.
2. Persista `DocumentRecord`, `Ticket`, `AgentRun`, `ApprovalRequest`, `AgentEvaluation` e `AuditEvent` no Azure Database for PostgreSQL.
3. Troque o dispatch local da outbox por um publisher para Azure Service Bus.
4. Publique `approval.required`, `approval.approved` e `approval.rejected` no Azure Service Bus.
5. Envie traces de execucao, scores e flags para Application Insights.
6. Crie alertas no Azure Monitor:

```txt
pendingApprovals > 20
averageQualityScore < 70
approval.required com flag critical
```

7. Use Key Vault para separar segredos de LLM por ambiente.

## Fase 4 - Azure DevOps

1. Crie um projeto no Azure DevOps.
2. Crie um repositório Git ou conecte o GitHub.
3. Configure pipeline com etapas:

```txt
npm ci
npm run typecheck
npm test
npm run build
docker build backend
docker build frontend
docker push ACR
deploy Container Apps ou AKS
```

4. Proteja branches com build obrigatório.
5. Adicione aprovação manual antes de produção.

## Como explicar na entrevista

Use esta narrativa:

> Comecei com um MVP local e desacoplado. O backend usa portas/adapters para LLM, vector store e eventos. Em desenvolvimento roda com mock e embeddings locais. Em produção, o mesmo contrato troca para LiteLLM, Azure OpenAI, Qdrant, Service Bus, Blob Storage, PostgreSQL, Key Vault e Azure Monitor.
