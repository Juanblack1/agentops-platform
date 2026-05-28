import { cosineSimilarity, type VectorPoint, type VectorSearchResult, type VectorStore } from "./vectorStore";

export class MemoryVectorStore implements VectorStore {
  private readonly points = new Map<string, VectorPoint>();

  async upsert(points: VectorPoint[]) {
    for (const point of points) {
      this.points.set(point.id, point);
    }
  }

  async search(vector: number[], topK: number): Promise<VectorSearchResult[]> {
    return [...this.points.values()]
      .map((point) => ({
        payload: point.payload,
        score: cosineSimilarity(vector, point.vector)
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);
  }
}
