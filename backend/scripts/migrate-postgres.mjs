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
const migrationPath = join(currentDir, "..", "migrations", "001_agentops_snapshot.sql");
const sql = await readFile(migrationPath, "utf8");
const pool = new Pool({ connectionString });

try {
  await pool.query(sql);
  console.log("PostgreSQL migrations applied.");
} finally {
  await pool.end();
}
