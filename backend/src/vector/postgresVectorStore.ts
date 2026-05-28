import { Pool } from "pg";
import type { VectorPoint, VectorSearchResult, VectorStore } from "./vectorStore";

export class PostgresVectorStore implements VectorStore {
  private constructor(
    private readonly pool: Pool,
    private readonly dimensions: number
  ) {}

  static async create(connectionString: string, dimensions: number) {
    const store = new PostgresVectorStore(new Pool({ connectionString }), dimensions);
    await store.migrate();
    return store;
  }

  async upsert(points: VectorPoint[]) {
    if (points.length === 0) {
      return;
    }

    await this.migrate();

    for (const point of points) {
      await this.pool.query(
        `
          insert into agentops_vector_points (id, embedding, payload, updated_at)
          values ($1, $2::vector, $3::jsonb, now())
          on conflict (id)
          do update set
            embedding = excluded.embedding,
            payload = excluded.payload,
            updated_at = now();
        `,
        [point.id, toVectorLiteral(point.vector, this.dimensions), JSON.stringify(point.payload)]
      );
    }
  }

  async search(vector: number[], topK: number): Promise<VectorSearchResult[]> {
    await this.migrate();

    const result = await this.pool.query<{ payload: VectorPoint["payload"]; score: number }>(
      `
        select payload, 1 - (embedding <=> $1::vector) as score
        from agentops_vector_points
        order by embedding <=> $1::vector
        limit $2;
      `,
      [toVectorLiteral(vector, this.dimensions), topK]
    );

    return result.rows.map((row) => ({
      payload: row.payload,
      score: Number(row.score)
    }));
  }

  async close() {
    await this.pool.end();
  }

  private async migrate() {
    await this.pool.query("create extension if not exists vector;");
    await this.pool.query(`
      create table if not exists agentops_vector_points (
        id text primary key,
        embedding vector(${this.dimensions}) not null,
        payload jsonb not null,
        updated_at timestamptz not null default now()
      );
    `);
    await this.pool.query(`
      create index if not exists agentops_vector_points_embedding_idx
      on agentops_vector_points
      using ivfflat (embedding vector_cosine_ops)
      with (lists = 8);
    `);
  }
}

function toVectorLiteral(vector: number[], dimensions: number) {
  if (vector.length !== dimensions) {
    throw new Error(`Expected ${dimensions} vector dimensions, received ${vector.length}.`);
  }

  return `[${vector.map((value) => Number(value.toFixed(6))).join(",")}]`;
}
