import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config/env";
import { buildServer } from "../src/server";

// Suite: Security and document upload API
// Invariant: configured API keys enforce roles, and supported uploads are ingested as RAG documents.
// Boundary IN: Fastify auth hook, route role checks and multipart upload route.
// Boundary OUT: external identity providers and binary document parsers.
describe("security and upload API", () => {
  it("keeps low-risk metadata routes public while protecting operational data routes", async () => {
    const app = await buildServer(
      loadConfig({
        NODE_ENV: "test",
        DATA_STORE: "memory",
        API_KEYS: "operator:operator-key,reviewer:reviewer-key,admin:admin-key"
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

    const agentsWithStaleKey = await app.inject({
      method: "GET",
      url: "/api/agents",
      headers: {
        "x-api-key": "stale-browser-key"
      }
    });
    expect(agentsWithStaleKey.statusCode).toBe(200);
    expect(agentsWithStaleKey.json().data.length).toBeGreaterThan(0);

    const metrics = await app.inject({
      method: "GET",
      url: "/api/metrics"
    });
    expect(metrics.statusCode).toBe(401);

    const metricsWithStaleKey = await app.inject({
      method: "GET",
      url: "/api/metrics",
      headers: {
        "x-api-key": "stale-browser-key"
      }
    });
    expect(metricsWithStaleKey.statusCode).toBe(401);

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

    await app.close();
  });

  it("does not expose API documentation by default in production", async () => {
    const app = await buildServer(
      loadConfig({
        NODE_ENV: "production",
        DATA_STORE: "memory",
        LLM_PROVIDER: "mock"
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
        API_KEYS: "operator:operator-key,reviewer:reviewer-key,admin:admin-key"
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
        DOCUMENT_STORAGE_DIR: mkdtempSync(join(tmpdir(), "agentops-upload-"))
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

  it("extracts PDF uploads before ingesting them as documents", async () => {
    const app = await buildServer(
      loadConfig({
        NODE_ENV: "test",
        DATA_STORE: "memory",
        DOCUMENT_STORAGE_DIR: mkdtempSync(join(tmpdir(), "agentops-upload-"))
      } as NodeJS.ProcessEnv)
    );

    const boundary = "----agentops-pdf-boundary";
    const pdfText = "Runbook PDF para RAG. Este documento valida ingestao de PDF com texto extraido corretamente.";
    const payload = Buffer.concat([
      Buffer.from(
        [
          `--${boundary}`,
          'Content-Disposition: form-data; name="file"; filename="runbook.pdf"',
          "Content-Type: application/pdf",
          "",
          ""
        ].join("\r\n")
      ),
      createSimplePdf(pdfText),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/api/documents/upload?classification=internal&tags=pdf,teste",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`
      },
      payload
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.title).toBe("runbook.pdf");
    expect(response.json().data.content).toContain("Runbook PDF para RAG");
    expect(response.json().data.chunks.length).toBeGreaterThan(0);

    await app.close();
  });
});

function createSimplePdf(text: string) {
  const escapedText = text.replace(/([\\()])/g, "\\$1");
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${escapedText}) Tj\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream\nendobj\n`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object) => {
    const offset = Buffer.byteLength(pdf, "latin1");
    pdf += object;
    return offset;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");

  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}
