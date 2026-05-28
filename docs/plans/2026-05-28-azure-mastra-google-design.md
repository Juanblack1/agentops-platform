# Azure, Mastra and Google LLM Design

## Goal

Make the platform useful as a real agentic AI backend while keeping Azure spend controlled.

## Decisions

- Keep Vercel as the main public UX path.
- Keep Azure resources available for real integration demos, but avoid always-on compute.
- Use Google Gemini through Vercel AI SDK as the first real LLM provider.
- Require API keys before enabling a real LLM provider in production.
- Use PostgreSQL/pgvector as the Azure vector store option to avoid running a separate Qdrant VM.
- Register agents, tools and workflow in Mastra so Mastra Studio can inspect and run them.
- Keep the existing Fastify runtime as the system of record for RAG, RBAC, audit, outbox and UI APIs.

## Cost Controls

- Azure budget alert on `rg-agentops-br-dev`.
- PostgreSQL remains stopped outside controlled migration/demo windows.
- Azure Container Apps template uses `minReplicas=0` and `maxReplicas=1`.
- Container Apps deployment script stops before creating resources if no backend image exists in ACR.

## Manual Inputs Still Required

- Google AI Studio API key, configured outside chat.
- Production `AGENTOPS_API_KEYS`.
- A backend image in ACR before deploying Azure Container Apps.
