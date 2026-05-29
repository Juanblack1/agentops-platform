import "dotenv/config";
import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => (value === "" ? undefined : value);

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  API_KEY: z.string().optional().default(""),
  ENABLE_API_DOCS: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? undefined : value.toLowerCase() === "true")),
  CORS_ORIGINS: z.string().optional().default(""),
  LOG_LEVEL: z.string().default("info"),
  DATA_STORE: z.enum(["memory", "file", "postgres"]).default("file"),
  DATA_FILE_PATH: z.string().default("../data/agentops-store.json"),
  POSTGRES_URL: z.string().optional().default(""),
  API_KEYS: z.string().optional().default(""),
  DEMO_API_KEY: z.string().optional().default(""),
  DEMO_RATE_LIMIT_MAX: z.coerce.number().int().nonnegative().default(30),
  DEMO_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600_000),
  LLM_PROVIDER: z.preprocess(emptyStringToUndefined, z.enum(["mock", "litellm", "google"]).default("mock")),
  LITELLM_BASE_URL: z.string().url().default("http://localhost:4000"),
  LITELLM_API_KEY: z.string().optional().default(""),
  LITELLM_MODEL: z.string().default("azure-gpt-4o-mini"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional().default(""),
  GOOGLE_GENERATIVE_AI_MODEL: z.string().default("gemini-2.5-flash"),
  MASTRA_MODEL: z.string().default("google/gemini-2.5-flash"),
  EMBEDDINGS_PROVIDER: z.enum(["local"]).default("local"),
  VECTOR_STORE: z.enum(["memory", "qdrant", "pgvector"]).default("memory"),
  QDRANT_URL: z.string().url().default("http://localhost:6333"),
  QDRANT_COLLECTION: z.string().default("agentops_documents"),
  OUTBOX_PUBLISHER: z.enum(["local", "servicebus"]).default("local"),
  AZURE_SERVICE_BUS_CONNECTION_STRING: z.string().optional().default(""),
  AZURE_SERVICE_BUS_TOPIC: z.string().optional().default("agentops-events"),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(8_000_000),
  DOCUMENT_STORAGE: z.enum(["local", "azure-blob"]).default("local"),
  DOCUMENT_STORAGE_DIR: z.string().default("../data/uploads"),
  AZURE_STORAGE_CONNECTION_STRING: z.string().optional().default(""),
  AZURE_STORAGE_CONTAINER: z.string().default("agentops-documents"),
  OTEL_SERVICE_NAME: z.string().default("agentops-backend"),
  SEED_DEMO_DATA: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() === "true")
}).transform((config) => ({
  ...config,
  ENABLE_API_DOCS: config.ENABLE_API_DOCS ?? config.NODE_ENV !== "production"
}));

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const config = applyProviderDefaults(EnvSchema.parse(source), source);
  const runningOnVercel = Boolean(source.VERCEL);

  if (!runningOnVercel) {
    return config;
  }

  return {
    ...config,
    DATA_FILE_PATH:
      config.DATA_STORE === "file" && !source.DATA_FILE_PATH ? "/tmp/agentops-store.json" : config.DATA_FILE_PATH,
    DOCUMENT_STORAGE_DIR:
      config.DOCUMENT_STORAGE === "local" && !source.DOCUMENT_STORAGE_DIR
        ? "/tmp/agentops-uploads"
        : config.DOCUMENT_STORAGE_DIR
  };
}

function applyProviderDefaults(config: AppConfig, source: NodeJS.ProcessEnv): AppConfig {
  const explicitProvider = typeof source.LLM_PROVIDER === "string" && source.LLM_PROVIDER.trim().length > 0;

  if (!explicitProvider && config.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      ...config,
      LLM_PROVIDER: "google"
    };
  }

  return config;
}
