import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env";
import { buildServer } from "../src/server";

// Suite: Persistent store API
// Invariant: file-backed mode preserves documents, runs and evaluations across server restarts.
// Boundary IN: Fastify routes, PersistentStore, RAG reindexing and local vector store.
// Boundary OUT: external LLMs, Qdrant, PostgreSQL and cloud services.
describe("persistent store API", () => {
  it("restores saved platform data and reindexes RAG context after restart", async () => {
    const filePath = join(mkdtempSync(join(tmpdir(), "agentops-store-")), "store.json");
    const config = loadConfig({
      NODE_ENV: "test",
      DATA_STORE: "file",
      DATA_FILE_PATH: filePath,
      SEED_DEMO_DATA: "false"
    } as NodeJS.ProcessEnv);

    const firstApp = await buildServer(config);

    const documentResponse = await firstApp.inject({
      method: "POST",
      url: "/api/documents",
      payload: {
        title: "Persistencia RAG",
        content:
          "A plataforma deve reindexar documentos persistidos quando reinicia para que o RAG continue encontrando runbooks e politicas internas.",
        tags: ["persistencia", "rag"],
        classification: "internal"
      }
    });
    expect(documentResponse.statusCode).toBe(201);

    const runResponse = await firstApp.inject({
      method: "POST",
      url: "/api/agents/support/run",
      payload: {
        prompt: "Como garantir que documentos persistidos continuem no RAG apos restart?"
      }
    });
    expect(runResponse.statusCode).toBe(201);
    expect(runResponse.json().data.retrievedContext.length).toBeGreaterThan(0);

    await firstApp.close();

    const secondApp = await buildServer(config);

    const documentsResponse = await secondApp.inject({
      method: "GET",
      url: "/api/documents"
    });
    expect(documentsResponse.statusCode).toBe(200);
    expect(documentsResponse.json().data).toHaveLength(1);

    const runsResponse = await secondApp.inject({
      method: "GET",
      url: "/api/agent-runs"
    });
    expect(runsResponse.json().data).toHaveLength(1);

    const rerunResponse = await secondApp.inject({
      method: "POST",
      url: "/api/agents/support/run",
      payload: {
        prompt: "O RAG encontra documentos persistidos depois que o servidor reinicia?"
      }
    });
    expect(rerunResponse.statusCode).toBe(201);
    expect(rerunResponse.json().data.retrievedContext[0].title).toBe("Persistencia RAG");

    await secondApp.close();
  });
});
