# ADR 006 - Adapters Cloud para PostgreSQL, Service Bus e Upload

## Status

Aceito.

## Contexto

O projeto precisava sair do nivel de MVP local e demonstrar integrações corporativas reais sem obrigar o desenvolvedor a ter Azure configurado desde o primeiro dia.

## Decisao

Adicionar adapters configuráveis:

- `DATA_STORE=postgres` usa PostgreSQL via `pg` e snapshot JSONB.
- `OUTBOX_PUBLISHER=servicebus` usa `@azure/service-bus`.
- Upload multipart aceita documentos textuais `.txt/.md` para ingestao RAG.
- `API_KEYS` permite RBAC simples por roles `operator`, `reviewer` e `admin`.
- Pontos OpenTelemetry foram adicionados em agent run, RAG retrieval e outbox dispatch.

## Consequencias

- O modo local continua simples com `DATA_STORE=file` e `OUTBOX_PUBLISHER=local`.
- O mesmo backend consegue rodar com PostgreSQL e Service Bus quando as variáveis estão configuradas.
- O PostgreSQL inicial e snapshot-based; normalizacao relacional completa fica para evolucao de escala.
- PDF/DOCX ainda exigem parser dedicado antes de entrar em producao.
