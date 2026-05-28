export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  dimensions: number;
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 64;

  async embed(text: string): Promise<number[]> {
    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter(Boolean);

    for (const token of tokens) {
      const index = Math.abs(hashToken(token)) % this.dimensions;
      vector[index] += 1;
    }

    const magnitude = Math.sqrt(vector.reduce((total, value) => total + value * value, 0)) || 1;
    return vector.map((value) => Number((value / magnitude).toFixed(6)));
  }
}

function hashToken(token: string) {
  let hash = 5381;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 33) ^ token.charCodeAt(index);
  }
  return hash;
}
