import type { IncomingMessage, ServerResponse } from "node:http";
import type { InjectOptions } from "light-my-request";

type BuildServer = typeof import("../backend/dist/server.js").buildServer;

let appPromise: ReturnType<BuildServer> | undefined;

function applyVercelDefaults() {
  const defaults: Record<string, string> = {
    DATA_STORE: "memory",
    DOCUMENT_STORAGE: "local",
    DOCUMENT_STORAGE_DIR: "/tmp/agentops-uploads",
    LLM_PROVIDER: "mock",
    GOOGLE_GENERATIVE_AI_MODEL: "gemini-2.5-flash",
    MASTRA_MODEL: "google/gemini-2.5-flash",
    VECTOR_STORE: "memory",
    OUTBOX_PUBLISHER: "local",
    LOG_LEVEL: "warn"
  };

  for (const [key, value] of Object.entries(defaults)) {
    process.env[key] ??= value;
  }
}

async function getApp() {
  applyVercelDefaults();
  const { buildServer } = await import("../backend/dist/server.js");
  appPromise ??= buildServer();
  return appPromise;
}

async function readRequestBody(request: IncomingMessage) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function setResponseHeader(response: ServerResponse, name: string, value: unknown) {
  if (typeof value === "string" || typeof value === "number" || Array.isArray(value)) {
    response.setHeader(name, value);
  }
}

function normalizeMethod(method: string | undefined): InjectOptions["method"] {
  switch (method) {
    case "DELETE":
    case "GET":
    case "HEAD":
    case "PATCH":
    case "POST":
    case "PUT":
    case "OPTIONS":
      return method;
    default:
      return "GET";
  }
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const app = await getApp();
  const payload = await readRequestBody(request);
  const injectOptions: InjectOptions = {
    method: normalizeMethod(request.method),
    url: request.url ?? "/",
    headers: request.headers
  };

  if (payload) {
    injectOptions.payload = payload;
  }

  const result = await app.inject(injectOptions);

  response.statusCode = result.statusCode;

  for (const [name, value] of Object.entries(result.headers)) {
    setResponseHeader(response, name, value);
  }

  response.end(result.body);
}
