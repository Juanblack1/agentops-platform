# PRD - AgentOps Platform

## Problema

Times corporativos querem usar agentes de IA com segurança, contexto privado, rastreabilidade e governança. Um chatbot isolado não resolve porque não integra workflows, auditoria, RAG e operação.

## Usuários

- Analista de atendimento que precisa responder tickets com base de conhecimento.
- Gestor de plataforma que precisa auditar execuções e custos.
- Time de TI que precisa triagem e diagnóstico.
- Time de compliance que precisa aprovar respostas sensíveis.

## Requisitos funcionais

- Cadastrar documentos para RAG.
- Criar tickets corporativos.
- Executar agentes especializados.
- Registrar auditoria de cada execução.
- Avaliar execuções de agente com score de recuperação, grounding, segurança e utilidade.
- Criar aprovações humanas para respostas com risco alto.
- Consultar eventos e métricas de execução.
- Rodar localmente sem LLM externa.
- Persistir dados locais entre reinicios do backend.
- Exportar snapshot operacional para backup.
- Permitir configuração posterior com LiteLLM e Azure OpenAI.

## Requisitos não funcionais

- Código TypeScript fortemente organizado.
- API REST documentada.
- Arquitetura com portas/adapters.
- Observabilidade por logs estruturados.
- Containerização local.
- Caminho de deploy para Azure.

## Fora do escopo inicial

- Autenticação Entra ID real.
- Persistência PostgreSQL completa.
- Restore de snapshot com limpeza segura de vector store.
- Upload binário de PDF/DOCX.
- Runtime CopilotKit/Mastra completo em produção.
- Persistência PostgreSQL real para aprovações e avaliações.

Esses pontos entram como evolução para a segunda fase.
