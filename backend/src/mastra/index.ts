import { agentCatalog } from "../agents/catalog";

const mastraModel = process.env.MASTRA_MODEL ?? "google/gemini-2.5-flash";
const registeredTools = [
  "rag.search",
  "ticket.classify",
  "governance.evaluate",
  "answer.compose",
  "runbook.suggest",
  "pii.detect"
];

export function getMastraRuntimeSummary() {
  return {
    framework: "Mastra",
    mode: "studio-runtime",
    studio: {
      apiCommand: "npm run mastra:dev -w backend",
      studioCommand: "npm run mastra:studio -w backend",
      apiUrl: "http://localhost:4111",
      studioUrl: "http://localhost:3001"
    },
    registeredAgents: Object.values(agentCatalog).map((agent) => agent.name),
    registeredTools,
    registeredWorkflows: ["ticket-triage-workflow"],
    model: mastraModel,
    note:
      "Mastra Studio uses backend/mastra. The Fastify runtime keeps RAG persistence, RBAC, audit, outbox and UI APIs."
  };
}
