# Azure Automation

This folder contains an Azure Bicep deployment for the cloud pieces used by AgentOps Platform.

## What it creates

- Azure Storage Account and private blob container for raw documents.
- Azure Container Registry for backend and frontend images.
- Azure Service Bus namespace and topic for outbox messages.
- Azure Database for PostgreSQL Flexible Server and `agentops` database.

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

Use the deployment outputs to configure `backend/.env`:

```env
DATA_STORE=postgres
POSTGRES_URL=postgres://agentopsadmin:<password>@<postgres-host>:5432/agentops
DOCUMENT_STORAGE=azure-blob
AZURE_STORAGE_CONNECTION_STRING=<storage-connection-string>
AZURE_STORAGE_CONTAINER=agentops-documents
OUTBOX_PUBLISHER=servicebus
AZURE_SERVICE_BUS_CONNECTION_STRING=<service-bus-connection-string>
AZURE_SERVICE_BUS_TOPIC=agentops-events
```

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
