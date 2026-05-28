# ADR 002 - RAG com Vector Store Plugavel

## Status

Aceito.

## Contexto

Qdrant faz parte da stack alvo, mas o primeiro MVP precisa rodar rapido em qualquer maquina.

## Decisao

Criar a porta `VectorStore` com dois adapters:

- `MemoryVectorStore` para desenvolvimento e testes.
- `QdrantVectorStore` para execucao local com Docker ou cloud.

Embeddings locais determinísticos sao usados no primeiro corte. O contrato permite trocar por embeddings via LiteLLM/Azure OpenAI depois.

## Consequencias

- Testes ficam determinísticos.
- O projeto consegue demonstrar RAG sem custo externo.
- A evolucao para Qdrant e Azure OpenAI nao muda a API publica.
