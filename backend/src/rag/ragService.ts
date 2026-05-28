import { randomUUID } from "node:crypto";
import type { Classification, DocumentRecord, DocumentStorageObject, RetrievedContext } from "../domain/types";
import { InMemoryStore } from "../repositories/inMemoryStore";
import { withSpan } from "../observability/tracing";
import type { EmbeddingProvider } from "./localEmbedding";
import { chunkText } from "./chunker";
import type { VectorPoint, VectorStore } from "../vector/vectorStore";

interface IngestInput {
  title: string;
  content: string;
  tags: string[];
  classification: Classification;
  rawStorage?: DocumentStorageObject;
}

export class RagService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly embeddings: EmbeddingProvider,
    private readonly vectorStore: VectorStore
  ) {}

  async ingest(input: IngestInput) {
    const documentId = randomUUID();
    const chunks = chunkText({
      documentId,
      content: input.content,
      tags: input.tags,
      classification: input.classification
    });

    const document = this.store.saveDocument({
      id: documentId,
      title: input.title,
      content: input.content,
      tags: input.tags,
      classification: input.classification,
      rawStorage: input.rawStorage,
      chunks
    });

    await this.vectorStore.upsert(await this.buildVectorPoints(document));
    return document;
  }

  async reindexDocuments(documents: DocumentRecord[]) {
    const points: VectorPoint[] = [];

    for (const document of documents) {
      points.push(...(await this.buildVectorPoints(document)));
    }

    await this.vectorStore.upsert(points);
  }

  async retrieve(query: string, topK = 4): Promise<RetrievedContext[]> {
    return withSpan("rag.retrieve", { "rag.top_k": topK }, async (span) => {
      const vector = await this.embeddings.embed(query);
      const results = await this.vectorStore.search(vector, topK);
      span.setAttribute("rag.result_count", results.length);

      return results.map((result) => ({
        chunkId: result.payload.chunkId,
        documentId: result.payload.documentId,
        title: result.payload.title,
        content: result.payload.content,
        score: Number(result.score.toFixed(4)),
        tags: result.payload.tags,
        classification: result.payload.classification
      }));
    });
  }

  private async buildVectorPoints(document: DocumentRecord): Promise<VectorPoint[]> {
    const points: VectorPoint[] = [];

    for (const chunk of document.chunks) {
      points.push({
        id: chunk.id,
        vector: await this.embeddings.embed(chunk.content),
        payload: {
          chunkId: chunk.id,
          documentId: document.id,
          title: document.title,
          content: chunk.content,
          tags: chunk.tags,
          classification: chunk.classification
        }
      });
    }

    return points;
  }
}
