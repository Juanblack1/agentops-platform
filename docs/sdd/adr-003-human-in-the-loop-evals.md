# ADR 003 - Human-in-the-loop e Evals Deterministicos

## Status

Aceito.

## Contexto

Uma plataforma corporativa de IA nao pode apenas responder prompts. Ela precisa auditar risco, medir qualidade e permitir intervencao humana quando uma resposta envolve dados sensiveis, compliance ou credenciais.

## Decisao

Cada `AgentRun` gera uma `AgentEvaluation` com quatro scores:

- Recuperacao RAG.
- Grounding contra contexto recuperado.
- Seguranca.
- Utilidade operacional.

Quando as politicas de governanca geram flag alta ou critica, o backend cria uma `ApprovalRequest` pendente. O revisor pode aprovar ou rejeitar pela API ou pelo frontend.

## Consequencias

- A plataforma passa a demonstrar governanca e nao apenas geracao de texto.
- Os scores sao deterministicos e rodam localmente sem LLM-as-judge.
- O mesmo contrato pode evoluir para avaliadores mais sofisticados, traces de producao e revisao humana formal.
- Persistencia real e eventos cloud ficam para a proxima etapa.
