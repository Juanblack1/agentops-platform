import type { IncomingMessage, ServerResponse } from "node:http";
import { buildServer } from "../backend/src/server";

let appPromise: ReturnType<typeof buildServer> | undefined;

function applyVercelDefaults() {
  const defaults: Record<string, string> = {
    DATA_STORE: "memory",
    DOCUMENT_STORAGE: "local",
    DOCUMENT_STORAGE_DIR: "/tmp/agentops-uploads",
    LLM_PROVIDER: "mock",
    VECTOR_STORE: "memory",
    OUTBOX_PUBLISHER: "local",
    SEED_DEMO_DATA: "true",
    LOG_LEVEL: "warn"
  };

  for (const [key, value] of Object.entries(defaults)) {
    process.env[key] ??= value;
  }
}

async function getApp() {
  applyVercelDefaults();
  appPromise ??= buildServer();
  return appPromise;
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const app = await getApp();
  app.server.emit("request", request, response);
}
