# Azure Automation

This folder contains an Azure Bicep deployment for the cloud pieces used by AgentOps Platform.

## What it creates

- Azure Storage Account and private blob container for raw documents.
- Azure Container Registry for backend and frontend images.
- Azure Service Bus namespace and topic for outbox messages.
- Azure Database for PostgreSQL Flexible Server and `agentops` database.
- Optional Azure Container Apps deployment for the backend with `minReplicas=0`.
- Optional monthly budget guardrail for the resource group.

## Prerequisites

1. Install Azure CLI.
2. Run:

```powershell
az login
```

3. Set a PostgreSQL admin password only in your shell:

```powershell
$env:AGENTOPS_POSTGRES_PASSWORD="use-a-strong-password"
```

## Provision

```powershell
.\infra\azure\provision.ps1 -ResourceGroupName rg-agentops-br-dev -Location brazilsouth -NamePrefix agentopsbrdev
```

## Cost guardrail

Create or update a monthly budget alert on the project resource group:

```powershell
.\infra\azure\create-budget.ps1 -Amount 100
```

This sends alerts at 50%, 80% and 100% to the Azure account email. It alerts only; it does not stop resources.

## Generate backend environment automatically

After provisioning, this reads the latest successful deployment outputs and fetches Storage and Service Bus connection strings with Azure CLI. It writes a local env file and does not print secrets to the terminal.

```powershell
$env:AGENTOPS_POSTGRES_PASSWORD="use-the-same-postgres-password"
.\infra\azure\export-backend-env.ps1 -ResourceGroupName rg-agentops-br-dev
```

Generated file:

```txt
backend/.env.azure.generated
```

## After provisioning

Use the deployment outputs to configure `backend/.env`. For Azure-backed RAG, enable `pgvector` only during a controlled migration window:

```env
DATA_STORE=postgres
POSTGRES_URL=postgres://agentopsadmin:<password>@<postgres-host>:5432/agentops
VECTOR_STORE=pgvector
DOCUMENT_STORAGE=azure-blob
AZURE_STORAGE_CONNECTION_STRING=<storage-connection-string>
AZURE_STORAGE_CONTAINER=agentops-documents
OUTBOX_PUBLISHER=servicebus
AZURE_SERVICE_BUS_CONNECTION_STRING=<service-bus-connection-string>
AZURE_SERVICE_BUS_TOPIC=agentops-events
```

Azure PostgreSQL Flexible Server requires `vector` in the `azure.extensions` allowlist before `CREATE EXTENSION vector` can run:

```powershell
.\infra\azure\enable-pgvector.ps1
$env:VECTOR_STORE="pgvector"
npm run db:migrate
```

If the server is stopped, start it only for this migration window and stop it again afterward.

Connection strings can be fetched with Azure CLI:

```powershell
az storage account show-connection-string --resource-group rg-agentops-br-dev --name <storage-account-name>
az servicebus namespace authorization-rule keys list --resource-group rg-agentops-br-dev --namespace-name <namespace> --name RootManageSharedAccessKey
```

## Build and push container images with Azure CLI

This uses Azure Container Registry Tasks, so local Docker does not need to be running. Some subscriptions block ACR Tasks; when that happens, use the Docker fallback below.

```powershell
.\infra\azure\build-and-push.ps1 -RegistryName <acr-name-from-output> -ImageTag dev-001
```

Docker fallback:

```powershell
.\infra\azure\docker-build-and-push.ps1 -RegistryName <acr-name-from-output> -ImageTag dev-001
```

For AKS, use the image names printed by the script in `infra/k8s/kustomization.yaml` or through Azure DevOps image substitution.

## Deploy backend to Azure Container Apps

Container Apps is the lower-cost runtime target for this project. The template uses a small backend container and `minReplicas=0`.

Prerequisites:

- Backend image already pushed to ACR as `agentops/backend:<tag>`.
- `AGENTOPS_API_KEYS` set in your shell. Do not commit it.
- Optional `GOOGLE_GENERATIVE_AI_API_KEY` set if deploying with `-LlmProvider google`.

```powershell
$env:AGENTOPS_API_KEYS="admin:<long-random-key>"
$env:GOOGLE_GENERATIVE_AI_API_KEY="<google-ai-studio-key>"
.\infra\azure\deploy-container-apps.ps1 -ImageTag dev -LlmProvider google -CorsOrigins "https://agentops-platform-rho.vercel.app"
```

The script reads `backend/.env.azure.generated` for Azure PostgreSQL, Blob Storage and Service Bus secrets when those values are not already set in the shell.
