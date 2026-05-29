# ADR 001 - Provider Gateway para LLMs

## Status

Aceito.

## Contexto

A plataforma exige integracao com multiplos LLMs e LiteLLM. Acoplar o backend diretamente a um SDK de provider criaria lock-in e dificultaria testes locais.

## Decisao

O backend usa a porta `LlmGateway`. O adapter default e `MockLlmGateway`, que permite rodar sem credenciais. O adapter produtivo inicial e `LiteLlmGateway`, que conversa com a API OpenAI-compatible exposta pelo LiteLLM.

## Consequencias

- O desenvolvimento local nao depende de chaves.
- Azure OpenAI, OpenAI, Claude e Gemini podem ser roteados pelo LiteLLM.
- Auditoria e politicas ficam no backend, nao no provider.
- Streaming e tool calling real ficam para a proxima iteracao.
