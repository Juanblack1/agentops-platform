import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env";
import { buildServer } from "../src/server";

// Suite: Agent workflow API
// Invariant: risky agent runs generate evaluation and a pending approval that can be decided through the public API.
// Boundary IN: Fastify routes, in-memory store, RAG retrieval, governance and evaluation services.
// Boundary OUT: external LLMs, Qdrant and cloud services.
describe("agent workflow API", () => {
  it("ingests a document, creates a ticket and runs an agent", async () => {
    const app = await buildServer(
      loadConfig({
        NODE_ENV: "test",
        DATA_STORE: "memory",
        SEED_DEMO_DATA: "false"
      } as NodeJS.ProcessEnv)
    );

    const documentResponse = await app.inject({
      method: "POST",
      url: "/api/documents",
      payload: {
        title: "Base de Teste",
        content:
          "Incidentes criticos devem ser classificados como P1. O time de TI deve validar gateway, filas e banco de dados antes de responder ao cliente.",
        tags: ["teste", "incidente"],
        classification: "internal"
      }
    });

    expect(documentResponse.statusCode).toBe(201);

    const ticketResponse = await app.inject({
      method: "POST",
      url: "/api/tickets",
      payload: {
        subject: "Sistema fora do ar",
        description: "Cliente relata indisponibilidade e timeout no login.",
        customer: "Cliente Teste"
      }
    });

    expect(ticketResponse.statusCode).toBe(201);
    expect(ticketResponse.json().data.assignedAgent).toBe("it-support");

    const runResponse = await app.inject({
      method: "POST",
      url: "/api/agents/support/run",
      payload: {
        prompt: "Como responder um incidente critico de indisponibilidade?"
      }
    });

    expect(runResponse.statusCode).toBe(201);
    expect(runResponse.json().data.retrievedContext.length).toBeGreaterThan(0);

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/api/metrics"
    });

    expect(metricsResponse.statusCode).toBe(200);
    expect(metricsResponse.json().data.agentRuns).toBe(1);

    await app.close();
  });

  it("creates an evaluation and approval request when a risky agent run is completed", async () => {
    const app = await buildServer(
      loadConfig({
        NODE_ENV: "test",
        DATA_STORE: "memory",
        SEED_DEMO_DATA: "false"
      } as NodeJS.ProcessEnv)
    );

    await app.inject({
      method: "POST",
      url: "/api/documents",
      payload: {
        title: "Governanca de Segredos",
        content:
          "Solicitacoes que mencionam senha, token, segredo ou API key exigem revisao humana antes de qualquer resposta externa.",
        tags: ["governanca", "seguranca"],
        classification: "restricted"
      }
    });

    const runResponse = await app.inject({
      method: "POST",
      url: "/api/agents/compliance/run",
      payload: {
        prompt: "Como responder quando o cliente pede senha ou token de acesso?"
      }
    });

    expect(runResponse.statusCode).toBe(201);
    const run = runResponse.json().data;
    expect(run.safetyFlags.map((flag: { code: string }) => flag.code)).toContain("secret.reference");

    const evaluationsResponse = await app.inject({
      method: "GET",
      url: "/api/evaluations"
    });
    expect(evaluationsResponse.statusCode).toBe(200);
    expect(evaluationsResponse.json().data[0].runId).toBe(run.id);
    expect(evaluationsResponse.json().data[0].overallScore).toBeGreaterThan(0);

    const approvalsResponse = await app.inject({
      method: "GET",
      url: "/api/approvals"
    });
    expect(approvalsResponse.statusCode).toBe(200);
    expect(approvalsResponse.json().data).toHaveLength(1);
    expect(approvalsResponse.json().data[0].status).toBe("pending");

    const approvalId = approvalsResponse.json().data[0].id;
    const decisionResponse = await app.inject({
      method: "POST",
      url: `/api/approvals/${approvalId}/decision`,
      payload: {
        decision: "rejected",
        actor: "qa-reviewer",
        reason: "Resposta menciona segredos e precisa de reformulacao."
      }
    });

    expect(decisionResponse.statusCode).toBe(200);
    expect(decisionResponse.json().data.status).toBe("rejected");

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/api/metrics"
    });
    expect(metricsResponse.json().data.pendingApprovals).toBe(0);
    expect(metricsResponse.json().data.evaluations).toBe(1);
    expect(metricsResponse.json().data.outboxPending).toBeGreaterThan(0);

    const dispatchResponse = await app.inject({
      method: "POST",
      url: "/api/outbox/dispatch",
      payload: {
        limit: 50
      }
    });
    expect(dispatchResponse.statusCode).toBe(200);
    expect(dispatchResponse.json().data.delivered.length).toBeGreaterThan(0);

    const dispatchedMetricsResponse = await app.inject({
      method: "GET",
      url: "/api/metrics"
    });
    expect(dispatchedMetricsResponse.json().data.outboxPending).toBe(0);

    await app.close();
  });
});
