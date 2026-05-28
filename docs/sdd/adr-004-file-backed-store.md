# ADR 004 - Persistencia Local com Snapshot JSON

## Status

Aceito.

## Contexto

O primeiro MVP usava apenas memoria. Isso era suficiente para testes, mas ruim para demonstrar operacao real: reiniciar o backend apagava documentos, tickets, execucoes, avaliacoes e aprovacoes.

## Decisao

Adicionar `DATA_STORE=memory|file`.

O modo default em desenvolvimento passa a ser `file`, gravando um snapshot JSON atomico em `../data/agentops-store.json`. O `InMemoryStore` continua existindo para testes rapidos e cenarios temporarios. No boot, o backend reindexa documentos persistidos no vector store para manter o RAG funcional apos restart.

Tambem foi exposto `GET /api/admin/snapshot` para backup logico.

## Por que nao restaurar snapshot ainda

Restore seguro exigiria limpar e reconstruir o vector store. O adapter em memoria poderia fazer isso facilmente, mas Qdrant precisaria de operacao explicita de recriacao de collection ou delete por filtro. Sem isso, um restore poderia manter chunks antigos no indice e gerar contexto obsoleto.

## Consequencias

- Desenvolvimento local fica persistente sem banco nativo.
- O projeto evita dependencias nativas que podem falhar no Windows/Node 25.
- O contrato de store fica pronto para evoluir para PostgreSQL.
- A decisao deixa claro o limite entre persistencia transacional e indice vetorial.
