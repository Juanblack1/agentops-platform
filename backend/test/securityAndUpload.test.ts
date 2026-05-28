import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config/env";
import { buildServer } from "../src/server";

// Suite: Security and document upload API
// Invariant: configured API keys enforce roles, and text uploads are ingested as RAG documents.
// Boundary IN: Fastify auth hook, route role checks and multipart upload route.
// Boundary OUT: external identity providers and binary document parsers.
describe("security and upload API", () => {
  it("keeps low-risk metadata routes public while protecting operational data routes", async () => {
    const app = await buildServer(
      loadConfig({
        NODE_ENV: "test",
        DATA_STORE: "memory",
        API_KEYS: "operator:operator-key,reviewer:reviewer-key,admin:admin-key",
        SEED_DEMO_DATA: "false"
      } as NodeJS.ProcessEnv)
    );

    const system = await app.inject({
      method: "GET",
      url: "/api/system"
    });
    expect(system.statusCode).toBe(200);
    expect(system.headers["x-content-type-options"]).toBe("nosniff");
    expect(system.json().data.authRequired).toBe(true);
    expect(system.json().data.dataFilePath).toBeUndefined();

    const readiness = await app.inject({
      method: "GET",
      url: "/readiness"
    });
    expect(readiness.statusCode).toBe(200);
    expect(readiness.json()).toEqual({
      status: "ready"
    });

    const blockedCors = await app.inject({
      method: "GET",
      url: "/api/system",
      headers: {
        origin: "https://evil.example"
      }
    });
    expect(blockedCors.headers["access-control-allow-origin"]).toBeUndefined();

    const allowedCors = await app.inject({
      method: "GET",
      url: "/api/system",
      headers: {
        origin: "http://localhost:5173"
      }
    });
    expect(allowedCors.headers["access-control-allow-origin"]).toBe("http://localhost:5173");

    const mastra = await app.inject({
      method: "GET",
      url: "/api/agents/mastra"
    });
    expect(mastra.statusCode).toBe(200);

    const metrics = await app.inject({
      method: "GET",
      url: "/api/metrics"
    });
    expect(metrics.statusCode).toBe(401);

    const documents = await app.inject({
      method: "GET",
      url: "/api/documents"
    });
    expect(documents.statusCode).toBe(401);

    const run = await app.inject({
      method: "POST",
      url: "/api/agents/support/run",
      payload: {
        prompt: "Sem chave nao deve consumir LLM real."
      }
    });
    expect(run.statusCode).toBe(401);

    const seed = await app.inject({
      method: "POST",
      url: "/api/demo/seed"
    });
    expect(seed.statusCode).toBe(401);

    await app.close();
  });

  it("does not expose API documentation by default in production", async () => {
    const app = await buildServer(
      loadConfig({
        NODE_ENV: "production",
        DATA_STORE: "memory",
        LLM_PROVIDER: "mock",
        SEED_DEMO_DATA: "false"
      } as NodeJS.ProcessEnv)
    );

    const docs = await app.inject({
      method: "GET",
      url: "/docs"
    });
    expect(docs.statusCode).toBe(404);

    await app.close();
  });

  it("enforces role-based API keys on sensitive endpoints", async () => {
    const app = await buildServer(
      loadConfig({
        NODE_ENV: "test",
        DATA_STORE: "memory",
        API_KEYS: "operator:operator-key,reviewer:reviewer-key,admin:admin-key",
        SEED_DEMO_DATA: "false"
      } as NodeJS.ProcessEnv)
    );

    const denied = await app.inject({
      method: "GET",
      url: "/api/admin/snapshot",
      headers: {
        "x-api-key": "operator-key"
      }
    });
    expect(denied.statusCode).toBe(403);

    const allowed = await app.inject({
      method: "GET",
      url: "/api/admin/snapshot",
      headers: {
        "x-api-key": "admin-key"
      }
    });
    expect(allowed.statusCode).toBe(200);

    const run = await app.inject({
      method: "POST",
      url: "/api/agents/support/run",
      headers: {
        "x-api-key": "operator-key"
      },
      payload: {
        prompt: "Operador pode executar agente?"
      }
    });
    expect(run.statusCode).toBe(201);

    await app.close();
  });

  it("ingests a multipart text upload as a document", async () => {
    const app = await buildServer(
      loadConfig({
        NODE_ENV: "test",
        DATA_STORE: "memory",
        DOCUMENT_STORAGE_DIR: mkdtempSync(join(tmpdir(), "agentops-upload-")),
        SEED_DEMO_DATA: "false"
      } as NodeJS.ProcessEnv)
    );

    const boundary = "----agentops-test-boundary";
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="runbook.md"',
      "Content-Type: text/markdown",
      "",
      "Runbook de upload para RAG. Este documento valida ingestao multipart com conteudo textual suficiente.",
      `--${boundary}--`,
      ""
    ].join("\r\n");

    const response = await app.inject({
      method: "POST",
      url: "/api/documents/upload?classification=internal&tags=upload,teste",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`
      },
      payload: body
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.title).toBe("runbook.md");
    expect(response.json().data.chunks.length).toBeGreaterThan(0);
    expect(response.json().data.rawStorage.provider).toBe("local");

    const rejectedBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="payload.exe"',
      "Content-Type: application/octet-stream",
      "",
      "Runbook com extensao invalida, apesar de conter texto suficiente para passar pelo parser.",
      `--${boundary}--`,
      ""
    ].join("\r\n");

    const rejectedResponse = await app.inject({
      method: "POST",
      url: "/api/documents/upload?classification=internal&tags=upload,teste",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`
      },
      payload: rejectedBody
    });
    expect(rejectedResponse.statusCode).toBe(415);

    await app.close();
  });
});
