import type { VectorPoint, VectorSearchResult, VectorStore } from "./vectorStore";

interface QdrantSearchResponse {
  result?: Array<{
    score: number;
    payload: VectorPoint["payload"];
  }>;
}

export class QdrantVectorStore implements VectorStore {
  private initialized = false;

  constructor(
    private readonly baseUrl: string,
    private readonly collectionName: string,
    private readonly dimensions: number
  ) {}

  async upsert(points: VectorPoint[]) {
    if (points.length === 0) {
      return;
    }

    await this.ensureCollection();

    const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}/points`, {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        points: points.map((point) => ({
          id: point.id,
          vector: point.vector,
          payload: point.payload
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Qdrant upsert failed with status ${response.status}`);
    }
  }

  async search(vector: number[], topK: number): Promise<VectorSearchResult[]> {
    await this.ensureCollection();

    const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}/points/search`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        vector,
        limit: topK,
        with_payload: true
      })
    });

    if (!response.ok) {
      throw new Error(`Qdrant search failed with status ${response.status}`);
    }

    const data = (await response.json()) as QdrantSearchResponse;
    return (data.result ?? []).map((item) => ({
      payload: item.payload,
      score: item.score
    }));
  }

  private async ensureCollection() {
    if (this.initialized) {
      return;
    }

    const existing = await fetch(`${this.baseUrl}/collections/${this.collectionName}`);
    if (existing.status === 404) {
      const created = await fetch(`${this.baseUrl}/collections/${this.collectionName}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          vectors: {
            size: this.dimensions,
            distance: "Cosine"
          }
        })
      });

      if (!created.ok) {
        throw new Error(`Qdrant collection creation failed with status ${created.status}`);
      }
    } else if (!existing.ok) {
      throw new Error(`Qdrant collection check failed with status ${existing.status}`);
    }

    this.initialized = true;
  }
}
