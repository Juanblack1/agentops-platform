import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("POSTGRES_URL must be configured to run migrations.");
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationPaths = [join(currentDir, "..", "migrations", "001_agentops_snapshot.sql")];

if (process.env.VECTOR_STORE === "pgvector") {
  migrationPaths.push(join(currentDir, "..", "migrations", "002_agentops_pgvector.sql"));
}

const pool = new Pool({ connectionString });

try {
  for (const migrationPath of migrationPaths) {
    await pool.query(await readFile(migrationPath, "utf8"));
  }
  console.log("PostgreSQL migrations applied.");
} finally {
  await pool.end();
}
