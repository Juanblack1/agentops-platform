import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fastify from "fastify";
import { ZodError } from "zod";
import { loadConfig, type AppConfig } from "./config/env";
import { InMemoryEventBus } from "./events/eventBus";
import { GoogleLlmGateway, LiteLlmGateway, MockLlmGateway } from "./llm/llmGateway";
import { createLogger } from "./observability/logger";
import { LocalEmbeddingProvider } from "./rag/localEmbedding";
import { RagService } from "./rag/ragService";
import { InMemoryStore } from "./repositories/inMemoryStore";
import { PostgresSnapshotStore } from "./repositories/postgresStore";
import { PersistentStore } from "./repositories/persistentStore";
import { authIsEnabled, parseApiKeys, resolveApiPrincipal } from "./security/apiKeys";
import { AgentOrchestrator } from "./services/agentOrchestrator";
import { ApprovalService } from "./services/approvalService";
import { seedDemoData } from "./services/demoSeed";
import { EvaluationService } from "./services/evaluationService";
import { LocalOutboxPublisher, OutboxService, ServiceBusOutboxPublisher } from "./services/outboxService";
import { TicketService } from "./services/ticketService";
import { AzureBlobDocumentStorage, LocalDocumentStorage } from "./storage/documentStorage";
import { MemoryVectorStore } from "./vector/memoryVectorStore";
import { PostgresVectorStore } from "./vector/postgresVectorStore";
import { QdrantVectorStore } from "./vector/qdrantVectorStore";
import { registerRoutes } from "./http/routes";

export async function buildServer(config: AppConfig = loadConfig()) {
  const logger = createLogger(config);
  assertProductionAiGuard(config);
  assertProductionApiKeyStrength(config);
  const store =
    config.DATA_STORE === "postgres"
      ? await createPostgresStore(config.POSTGRES_URL)
      : config.DATA_STORE === "file"
        ? new PersistentStore(config.DATA_FILE_PATH)
        : new InMemoryStore();
  const eventBus = new InMemoryEventBus();
  const embeddings = new LocalEmbeddingProvider();
  const vectorStore =
    config.VECTOR_STORE === "qdrant"
      ? new QdrantVectorStore(config.QDRANT_URL, config.QDRANT_COLLECTION, embeddings.dimensions)
      : config.VECTOR_STORE === "pgvector"
        ? await PostgresVectorStore.create(requireConfigValue(config.POSTGRES_URL, "POSTGRES_URL"), embeddings.dimensions)
      : new MemoryVectorStore();

  const rag = new RagService(store, embeddings, vectorStore);
  await rag.reindexDocuments(store.listDocuments());
  const llm =
    config.LLM_PROVIDER === "litellm"
      ? new LiteLlmGateway(config.LITELLM_BASE_URL, config.LITELLM_API_KEY, config.LITELLM_MODEL)
      : config.LLM_PROVIDER === "google"
        ? new GoogleLlmGateway(
            requireConfigValue(config.GOOGLE_GENERATIVE_AI_API_KEY, "GOOGLE_GENERATIVE_AI_API_KEY"),
            config.GOOGLE_GENERATIVE_AI_MODEL
          )
      : new MockLlmGateway();

  const tickets = new TicketService(store, eventBus);
  const evaluations = new EvaluationService();
  const approvals = new ApprovalService(store, eventBus);
  const documentStorage =
    config.DOCUMENT_STORAGE === "azure-blob"
      ? new AzureBlobDocumentStorage(
          requireConfigValue(config.AZURE_STORAGE_CONNECTION_STRING, "AZURE_STORAGE_CONNECTION_STRING"),
          config.AZURE_STORAGE_CONTAINER
        )
      : new LocalDocumentStorage(config.DOCUMENT_STORAGE_DIR);
  const outboxPublisher =
    config.OUTBOX_PUBLISHER === "servicebus"
      ? new ServiceBusOutboxPublisher(
          requireConfigValue(config.AZURE_SERVICE_BUS_CONNECTION_STRING, "AZURE_SERVICE_BUS_CONNECTION_STRING"),
          config.AZURE_SERVICE_BUS_TOPIC
        )
      : new LocalOutboxPublisher(logger);
  const outbox = new OutboxService(store, outboxPublisher);
  const agents = new AgentOrchestrator(store, rag, llm, evaluations, eventBus, logger);

  eventBus.subscribe("approval.required", (event) => {
    logger.warn({ event }, "human approval required");
  });

  if (config.SEED_DEMO_DATA) {
    await seedDemoData(store, rag, tickets);
  }

  const app = fastify({
    logger: false
  });

  app.addHook("onRequest", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  });

  app.addHook("onClose", async () => {
    if ("flush" in store && typeof store.flush === "function") {
      await store.flush();
    }

    if ("close" in store && typeof store.close === "function") {
      await store.close();
    }

    if ("close" in vectorStore && typeof vectorStore.close === "function") {
      await vectorStore.close();
    }
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      callback(null, isOriginAllowed(config, origin));
    }
  });

  await app.register(multipart, {
    limits: {
      fileSize: config.UPLOAD_MAX_BYTES,
      files: 1
    }
  });

  if (config.ENABLE_API_DOCS) {
    await app.register(swagger, {
      openapi: {
        info: {
          title: "AgentOps Platform API",
          description: "Backend APIs for the corporate agentic AI platform.",
          version: "0.1.0"
        }
      }
    });

    await app.register(swaggerUi, {
      routePrefix: "/docs"
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "Request validation failed.",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;
    const message = error instanceof Error ? error.message : "Request failed.";

    if (statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({
        error: "request_error",
        message
      });
    }

    logger.error({ error }, "request failed");
    return reply.code(500).send({
      error: "internal_error",
      message: config.NODE_ENV === "production" ? "Internal server error." : message
    });
  });

  app.addHook("preHandler", async (request, reply) => {
    if (!authIsEnabled(config)) {
      return;
    }

    const apiKeyHeader = request.headers["x-api-key"];
    const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;

    if (!apiKey) {
      return;
    }

    const principal = resolveApiPrincipal(config, apiKey);

    if (!principal) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "Missing or invalid x-api-key header."
      });
    }

    request.headers["x-agentops-role"] = principal.role;
  });

  await registerRoutes(app, {
    config,
    store,
    rag,
    agents,
    tickets,
    approvals,
    outbox,
    documentStorage
  });

  return app;
}

async function createPostgresStore(connectionString: string) {
  return PostgresSnapshotStore.create(requireConfigValue(connectionString, "POSTGRES_URL"));
}

function requireConfigValue(value: string, name: string) {
  if (!value) {
    throw new Error(`${name} must be configured for this mode.`);
  }

  return value;
}

function assertProductionAiGuard(config: AppConfig) {
  if (config.NODE_ENV === "production" && config.LLM_PROVIDER !== "mock" && !authIsEnabled(config)) {
    throw new Error("API_KEYS must be configured before enabling a real LLM provider in production.");
  }
}

function assertProductionApiKeyStrength(config: AppConfig) {
  if (config.NODE_ENV !== "production") {
    return;
  }

  if (config.API_KEY && config.API_KEY.length < 16) {
    throw new Error("API_KEY must be at least 16 characters in production.");
  }

  for (const entry of parseApiKeys(config.API_KEYS)) {
    if (entry.key.length < 16) {
      throw new Error(`API key for role ${entry.role} must be at least 16 characters in production.`);
    }
  }
}

function isOriginAllowed(config: AppConfig, origin: string | undefined) {
  if (!origin) {
    return true;
  }

  const allowedOrigins = config.CORS_ORIGINS.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (config.NODE_ENV !== "production") {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }

  return false;
}
