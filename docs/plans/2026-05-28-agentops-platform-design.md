# AgentOps Platform Design

## Objetivo

Criar uma plataforma corporativa de IA agêntica para demonstrar experiência prática com Node.js, TypeScript, arquitetura distribuída, agentes, RAG, LiteLLM, Qdrant, observabilidade, governança, SDD e Azure.

## Arquitetura

O projeto usa um monorepo com backend e frontend. O backend concentra a regra de negócio, expõe REST APIs e separa integrações por portas/adapters. O frontend é um painel operacional para documentos, tickets, agentes e auditoria.

Fluxo principal:

```txt
React UI
  -> Fastify API
  -> Agent Orchestrator
  -> RAG Retrieval
  -> LLM Gateway
  -> Mock local ou LiteLLM
  -> Auditoria e eventos
```

## Componentes

- `backend`: API, agentes, RAG, workflows, auditoria, eventos e adapters.
- `frontend`: interface operacional para demonstrar o produto.
- `infra/litellm`: configuração inicial do gateway LLM.
- `docs/sdd`: requisitos e decisões no estilo Spec-Driven Development.
- `docs/azure`: roteiro de implantação e serviços Azure.

## Agentes

- `supervisor`: decide qual agente especializado deve atuar.
- `support`: responde perguntas usando contexto RAG.
- `triage`: classifica tickets por área, severidade e risco.
- `it-support`: sugere diagnóstico técnico.
- `compliance`: aplica políticas de segurança e governança.

## RAG

O primeiro corte usa embeddings locais determinísticos para rodar sem chave externa. A camada foi desenhada para trocar o adapter por embeddings via LiteLLM/Azure OpenAI. O vector store default é em memória, com adapter opcional para Qdrant.

## Governança

Cada execução de agente gera auditoria com entrada, agente, modelo, latência, contexto recuperado e flags de segurança. As políticas iniciais bloqueiam vazamento de segredo e marcam respostas que exigem aprovação humana.

## Azure

Azure entra como camada corporativa:

- Azure OpenAI por trás do LiteLLM.
- Azure Container Apps ou AKS para deploy.
- Azure Container Registry para imagens.
- Azure Service Bus para eventos.
- Azure Blob Storage para documentos.
- Azure Database for PostgreSQL para dados transacionais.
- Azure Key Vault para segredos.
- Azure Monitor/Application Insights para observabilidade.
- Azure DevOps para CI/CD.
