# Docker production

This stack runs the production API, web frontend, Postgres with pgvector, Qdrant, and optional Mastra Studio/LiteLLM services.

## Required environment

Create `.env` from `.env.example` and set at least:

```env
POSTGRES_PASSWORD=replace-with-a-long-random-password
API_KEYS=admin:replace-with-a-long-random-admin-key
CORS_ORIGINS=https://your-domain.example.com
LLM_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=replace-with-provider-key
```

For a local production smoke test, `CORS_ORIGINS=http://localhost:8080` is enough. Keep `LLM_PROVIDER=mock` only for smoke tests without an external model.

## Run

```powershell
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Open `http://localhost:8080`.

## Optional services

Mastra Studio:

```powershell
docker compose -f docker-compose.prod.yml --profile studio up -d mastra-studio
```

LiteLLM:

```powershell
docker compose -f docker-compose.prod.yml --profile llm up -d litellm
```

Use this profile when `LLM_PROVIDER=litellm`; set `LITELLM_MASTER_KEY`, `LITELLM_API_KEY`, and the Azure OpenAI variables required by `infra/litellm/config.yaml`.

## Operational checks

```powershell
docker compose -f docker-compose.prod.yml ps
curl http://localhost:8080/health
curl http://localhost:8080/readiness
curl -H "x-api-key: <admin-key>" http://localhost:8080/api/system
```

The frontend container is based on the unprivileged Nginx image and listens on port `8080`. The backend container runs as a non-root `agentops` user.
