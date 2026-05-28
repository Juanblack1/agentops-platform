import type { Classification } from "../domain/types";

export interface VectorPayload {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  tags: string[];
  classification: Classification;
}

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: VectorPayload;
}

export interface VectorSearchResult {
  payload: VectorPayload;
  score: number;
}

export interface VectorStore {
  upsert(points: VectorPoint[]): Promise<void>;
  search(vector: number[], topK: number): Promise<VectorSearchResult[]>;
}

export function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator === 0 ? 0 : dot / denominator;
}
