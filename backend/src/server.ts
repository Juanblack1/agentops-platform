import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fastify from "fastify";
import { loadConfig, type AppConfig } from "./config/env";
import { InMemoryEventBus } from "./events/eventBus";
import { LiteLlmGateway, MockLlmGateway } from "./llm/llmGateway";
import { createLogger } from "./observability/logger";
import { LocalEmbeddingProvider } from "./rag/localEmbedding";
import { RagService } from "./rag/ragService";
import { InMemoryStore } from "./repositories/inMemoryStore";
import { PostgresSnapshotStore } from "./repositories/postgresStore";
import { PersistentStore } from "./repositories/persistentStore";
import { authIsEnabled, resolveApiPrincipal } from "./security/apiKeys";
import { AgentOrchestrator } from "./services/agentOrchestrator";
import { ApprovalService } from "./services/approvalService";
import { seedDemoData } from "./services/demoSeed";
import { EvaluationService } from "./services/evaluationService";
import { LocalOutboxPublisher, OutboxService, ServiceBusOutboxPublisher } from "./services/outboxService";
import { TicketService } from "./services/ticketService";
import { AzureBlobDocumentStorage, LocalDocumentStorage } from "./storage/documentStorage";
import { MemoryVectorStore } from "./vector/memoryVectorStore";
import { QdrantVectorStore } from "./vector/qdrantVectorStore";
import { registerRoutes } from "./http/routes";

export async function buildServer(config: AppConfig = loadConfig()) {
  const logger = createLogger(config);
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
      : new MemoryVectorStore();

  const rag = new RagService(store, embeddings, vectorStore);
  await rag.reindexDocuments(store.listDocuments());
  const llm =
    config.LLM_PROVIDER === "litellm"
      ? new LiteLlmGateway(config.LITELLM_BASE_URL, config.LITELLM_API_KEY, config.LITELLM_MODEL)
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

  app.addHook("onClose", async () => {
    if ("flush" in store && typeof store.flush === "function") {
      await store.flush();
    }

    if ("close" in store && typeof store.close === "function") {
      await store.close();
    }
  });

  await app.register(cors, {
    origin: true
  });

  await app.register(multipart, {
    limits: {
      fileSize: config.UPLOAD_MAX_BYTES,
      files: 1
    }
  });

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

  app.addHook("preHandler", async (request, reply) => {
    if (!authIsEnabled(config)) {
      return;
    }

    const publicPath =
      request.url.startsWith("/health") ||
      request.url.startsWith("/readiness") ||
      request.url.startsWith("/docs") ||
      request.url.startsWith("/documentation");

    if (publicPath) {
      return;
    }

    const principal = resolveApiPrincipal(config, request.headers["x-api-key"]);

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
