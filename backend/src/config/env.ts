import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  API_KEY: z.string().optional().default(""),
  LOG_LEVEL: z.string().default("info"),
  DATA_STORE: z.enum(["memory", "file", "postgres"]).default("file"),
  DATA_FILE_PATH: z.string().default("../data/agentops-store.json"),
  POSTGRES_URL: z.string().optional().default(""),
  API_KEYS: z.string().optional().default(""),
  LLM_PROVIDER: z.enum(["mock", "litellm"]).default("mock"),
  LITELLM_BASE_URL: z.string().url().default("http://localhost:4000"),
  LITELLM_API_KEY: z.string().optional().default(""),
  LITELLM_MODEL: z.string().default("azure-gpt-4o-mini"),
  EMBEDDINGS_PROVIDER: z.enum(["local"]).default("local"),
  VECTOR_STORE: z.enum(["memory", "qdrant"]).default("memory"),
  QDRANT_URL: z.string().url().default("http://localhost:6333"),
  QDRANT_COLLECTION: z.string().default("agentops_documents"),
  OUTBOX_PUBLISHER: z.enum(["local", "servicebus"]).default("local"),
  AZURE_SERVICE_BUS_CONNECTION_STRING: z.string().optional().default(""),
  AZURE_SERVICE_BUS_TOPIC: z.string().optional().default("agentops-events"),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(1_000_000),
  DOCUMENT_STORAGE: z.enum(["local", "azure-blob"]).default("local"),
  DOCUMENT_STORAGE_DIR: z.string().default("../data/uploads"),
  AZURE_STORAGE_CONNECTION_STRING: z.string().optional().default(""),
  AZURE_STORAGE_CONTAINER: z.string().default("agentops-documents"),
  OTEL_SERVICE_NAME: z.string().default("agentops-backend"),
  SEED_DEMO_DATA: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() === "true")
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return EnvSchema.parse(source);
}
