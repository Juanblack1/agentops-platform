# ADR 005 - Event Outbox antes do Azure Service Bus

## Status

Aceito.

## Contexto

A plataforma precisa demonstrar arquitetura orientada a eventos. Publicar direto em um broker externo durante desenvolvimento local aumentaria friccao, mas ignorar eventos deixaria a arquitetura menos realista.

## Decisao

Todo `AuditEvent` salvo gera uma `OutboxMessage` no mesmo store. O endpoint `POST /api/outbox/dispatch` simula a entrega e marca mensagens como `delivered`.

O dispatch local e intencionalmente simples. Ele representa a fronteira que depois sera trocada por um adapter de Azure Service Bus.

## Consequencias

- Eventos ficam rastreaveis e persistidos.
- Falhas de entrega podem ser modeladas sem perder auditoria.
- O projeto passa a demonstrar o padrao transactional outbox.
- A integracao real com Service Bus fica isolada em um futuro publisher.
