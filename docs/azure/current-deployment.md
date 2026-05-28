# Current Azure Deployment

This environment was provisioned for the local portfolio project.

## Active resource group

```txt
rg-agentops-br-dev
```

## Region

```txt
brazilsouth
```

`eastus` was not usable for PostgreSQL Flexible Server in this subscription because Azure returned `LocationIsOfferRestricted`.

## Provisioned services

- Azure Container Registry
- Azure Database for PostgreSQL Flexible Server
- Azure Storage Account with private Blob container
- Azure Service Bus namespace and topic
- Azure Cost Management budget `agentops-dev-guardrail`

## Local files created

```txt
backend/.env.azure.generated
```

This file contains connection strings and is ignored by Git.

## Validation already performed

- PostgreSQL migration ran against Azure PostgreSQL.
- Backend smoke test started locally against Azure PostgreSQL.
- Document upload stored raw content in Azure Blob Storage.
- Audit event was persisted through the PostgreSQL-backed store.

## Known subscription limitation

ACR Tasks are blocked for this subscription with `TasksOperationsNotAllowed`. Use `infra/azure/docker-build-and-push.ps1` after Docker Desktop is installed and running, or publish through Azure DevOps with a hosted agent.

## Cost safety

PostgreSQL was stopped after validation to reduce compute cost:

```powershell
npm run azure:stop-postgres
```

Check active resources:

```powershell
npm run azure:cost-status
```

Destroy the dev environment when you do not need it:

```powershell
npm run azure:destroy-dev
```

The PostgreSQL server can automatically start again after 7 days, so destroying the dev resource group is the safest zero-cost option when the environment is not in use.

## Pending activation steps

- `pgvector` is implemented in the application and Bicep template. The existing PostgreSQL server is stopped, so Azure rejected the live allowlist update while stopped. Start PostgreSQL only for the migration window, run `npm run azure:enable-pgvector`, run the migration with `VECTOR_STORE=pgvector`, then stop PostgreSQL again.
- Azure Container Apps IaC is available in `infra/azure/container-apps.bicep`. It is intentionally not deployed until a backend image exists in ACR and `AGENTOPS_API_KEYS` is configured.
