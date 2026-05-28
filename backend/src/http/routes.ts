import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { listAgents } from "../agents/catalog";
import type { AppConfig } from "../config/env";
import type { AgentId } from "../domain/types";
import { governancePolicies } from "../governance/policies";
import { getMastraRuntimeSummary } from "../mastra";
import type { RagService } from "../rag/ragService";
import type { InMemoryStore } from "../repositories/inMemoryStore";
import { authIsEnabled, getRequestRole, type ApiRole } from "../security/apiKeys";
import type { AgentOrchestrator } from "../services/agentOrchestrator";
import type { ApprovalService } from "../services/approvalService";
import { seedDemoData } from "../services/demoSeed";
import type { OutboxService } from "../services/outboxService";
import type { TicketService } from "../services/ticketService";
import type { DocumentStorage } from "../storage/documentStorage";

export interface RouteServices {
  config: AppConfig;
  store: InMemoryStore;
  rag: RagService;
  agents: AgentOrchestrator;
  tickets: TicketService;
  approvals: ApprovalService;
  outbox: OutboxService;
  documentStorage: DocumentStorage;
}

const classificationSchema = z.enum(["public", "internal", "confidential", "restricted"]);
const agentIdSchema = z.enum(["supervisor", "support", "triage", "it-support", "compliance"]);

const createDocumentSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(20),
  tags: z.array(z.string().min(1)).default([]),
  classification: classificationSchema.default("internal")
});

const uploadDocumentQuerySchema = z.object({
  title: z.string().min(3).optional(),
  tags: z.string().optional().default("upload"),
  classification: classificationSchema.default("internal")
});

const createTicketSchema = z.object({
  subject: z.string().min(3),
  description: z.string().min(10),
  customer: z.string().min(2),
  actor: z.string().optional()
});

const runAgentSchema = z.object({
  prompt: z.string().min(3),
  actor: z.string().optional()
});

const approvalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  actor: z.string().min(2).default("local-reviewer"),
  reason: z.string().min(3).default("Decisao registrada pelo revisor.")
});

const outboxDispatchSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export async function registerRoutes(app: FastifyInstance, services: RouteServices) {
  app.get("/health", async () => ({
    status: "ok",
    service: "agentops-backend"
  }));

  app.get("/readiness", async () => ({
    status: "ready"
  }));

  app.get("/api/system", async () => ({
    data: {
      nodeEnv: services.config.NODE_ENV,
      authRequired: authIsEnabled(services.config),
      dataStore: services.config.DATA_STORE,
      llmProvider: services.config.LLM_PROVIDER,
      llmModel:
        services.config.LLM_PROVIDER === "google"
          ? services.config.GOOGLE_GENERATIVE_AI_MODEL
          : services.config.LLM_PROVIDER === "litellm"
            ? services.config.LITELLM_MODEL
            : "mock-local",
      vectorStore: services.config.VECTOR_STORE,
      qdrantCollection: services.config.QDRANT_COLLECTION
    }
  }));

  app.get("/api/agents", async () => ({
    data: listAgents()
  }));

  app.get("/api/agents/mastra", async () => ({
    data: getMastraRuntimeSummary()
  }));

  app.post("/api/agents/:agentId/run", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    const params = z.object({ agentId: agentIdSchema }).parse(request.params);
    const body = runAgentSchema.parse(request.body);
    const run = await services.agents.runAgent({
      agentId: params.agentId as AgentId,
      prompt: body.prompt,
      actor: body.actor
    });

    return reply.code(201).send({ data: run });
  });

  app.get("/api/agent-runs", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    return {
      data: services.store.listAgentRuns()
    };
  });

  app.get("/api/traces/:runId", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    const params = z.object({ runId: z.string().uuid() }).parse(request.params);
    const run = services.store.findAgentRun(params.runId);

    if (!run) {
      return reply.code(404).send({
        error: "not_found",
        message: "Trace not found for this run."
      });
    }

    return { data: run.trace };
  });

  app.get("/api/evaluations", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    return {
      data: services.store.listAgentEvaluations()
    };
  });

  app.get("/api/evaluations/:runId", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    const params = z.object({ runId: z.string().uuid() }).parse(request.params);
    const evaluation = services.store.findEvaluationByRunId(params.runId);

    if (!evaluation) {
      return reply.code(404).send({
        error: "not_found",
        message: "Evaluation not found for this run."
      });
    }

    return { data: evaluation };
  });

  app.get("/api/documents", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    return {
      data: services.store.listDocuments()
    };
  });

  app.post("/api/documents", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    const body = createDocumentSchema.parse(request.body);
    const document = await services.rag.ingest(body);
    services.store.saveAuditEvent({
      type: "document.ingested",
      actor: "local-user",
      entityId: document.id,
      metadata: {
        title: document.title,
        chunks: document.chunks.length,
        classification: document.classification
      }
    });

    return reply.code(201).send({ data: document });
  });

  app.post("/api/documents/upload", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    const query = uploadDocumentQuerySchema.parse(request.query);
    const upload = await request.file({
      limits: {
        fileSize: services.config.UPLOAD_MAX_BYTES
      }
    });

    if (!upload) {
      return reply.code(400).send({
        error: "missing_file",
        message: "Upload a text or markdown file using multipart field name 'file'."
      });
    }

    if (!isSupportedTextUpload(upload.filename, upload.mimetype)) {
      return reply.code(415).send({
        error: "unsupported_media_type",
        message: "Only .txt, .md or markdown text uploads are supported."
      });
    }

    const buffer = await upload.toBuffer();
    const content = buffer.toString("utf8").trim();

    if (content.length < 20 || content.includes("\u0000")) {
      return reply.code(400).send({
        error: "unsupported_document",
        message: "Only text-like UTF-8 documents are supported in this endpoint."
      });
    }

    const document = await services.rag.ingest({
      title: query.title ?? upload.filename,
      content,
      classification: query.classification,
      rawStorage: await services.documentStorage.store({
        filename: upload.filename,
        contentType: upload.mimetype,
        bytes: buffer
      }),
      tags: query.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    });
    services.store.saveAuditEvent({
      type: "document.ingested",
      actor: "local-user",
      entityId: document.id,
      metadata: {
        title: document.title,
        source: "multipart-upload",
        filename: upload.filename,
        storage: document.rawStorage,
        chunks: document.chunks.length,
        classification: document.classification
      }
    });

    return reply.code(201).send({ data: document });
  });

  app.get("/api/tickets", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    return {
      data: services.store.listTickets()
    };
  });

  app.post("/api/tickets", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    const body = createTicketSchema.parse(request.body);
    const ticket = await services.tickets.createTicket(body);
    return reply.code(201).send({ data: ticket });
  });

  app.get("/api/audit-events", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    return {
      data: services.store.listAuditEvents()
    };
  });

  app.get("/api/outbox", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    return {
      data: services.store.listOutboxMessages()
    };
  });

  app.post("/api/outbox/dispatch", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["admin"])) return;
    const body = outboxDispatchSchema.parse(request.body ?? {});
    const result = await services.outbox.dispatchPending(body.limit);
    return { data: result };
  });

  app.get("/api/approvals", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    return {
      data: services.store.listApprovalRequests()
    };
  });

  app.post("/api/approvals/:approvalId/decision", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["reviewer", "admin"])) return;
    const params = z.object({ approvalId: z.string().uuid() }).parse(request.params);
    const body = approvalDecisionSchema.parse(request.body);
    const result = await services.approvals.decide({
      approvalId: params.approvalId,
      decision: body.decision,
      actor: body.actor,
      reason: body.reason
    });

    if (result.status === "not_found") {
      return reply.code(404).send({
        error: "not_found",
        message: "Approval request not found."
      });
    }

    if (result.status === "already_decided") {
      return reply.code(409).send({
        error: "already_decided",
        message: "Approval request was already decided.",
        data: result.approval
      });
    }

    return { data: result.approval };
  });

  app.get("/api/metrics", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    return {
      data: services.store.metrics()
    };
  });

  app.get("/api/admin/snapshot", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["admin"])) return;
    return {
      data: services.store.exportSnapshot()
    };
  });

  app.get("/api/governance/policies", async () => ({
    data: governancePolicies
  }));

  app.post("/api/demo/seed", async (request, reply) => {
    if (requireRole(request, reply, services.config, ["operator", "reviewer", "admin"])) return;
    await seedDemoData(services.store, services.rag, services.tickets);
    return {
      data: services.store.metrics()
    };
  });
}

function isSupportedTextUpload(filename: string, mimetype: string) {
  const normalizedName = filename.toLowerCase();
  const hasTextExtension =
    normalizedName.endsWith(".txt") || normalizedName.endsWith(".md") || normalizedName.endsWith(".markdown");
  const normalizedMime = mimetype.toLowerCase();
  const hasTextMime =
    normalizedMime.startsWith("text/") ||
    normalizedMime === "application/markdown" ||
    normalizedMime === "application/octet-stream";

  return hasTextExtension && hasTextMime;
}

function requireRole(
  request: FastifyRequest,
  reply: FastifyReply | undefined,
  config: AppConfig,
  allowedRoles: ApiRole[]
) {
  if (!authIsEnabled(config)) {
    return false;
  }

  const role = getRequestRole(request);

  if (role === "anonymous") {
    reply?.code(401).send({
      error: "unauthorized",
      message: "Missing or invalid x-api-key header."
    });
    return true;
  }

  if (allowedRoles.includes(role)) {
    return false;
  }

  reply?.code(403).send({
    error: "forbidden",
    message: `This endpoint requires one of: ${allowedRoles.join(", ")}.`
  });
  return true;
}
