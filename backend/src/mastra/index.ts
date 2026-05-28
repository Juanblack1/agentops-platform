import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { agentCatalog } from "../agents/catalog";

export const supervisorAgent = new Agent({
  id: agentCatalog.supervisor.id,
  name: agentCatalog.supervisor.name,
  instructions: agentCatalog.supervisor.instructions,
  model: process.env.MASTRA_MODEL ?? "openai/gpt-4o-mini"
});

export const supportAgent = new Agent({
  id: agentCatalog.support.id,
  name: agentCatalog.support.name,
  instructions: agentCatalog.support.instructions,
  model: process.env.MASTRA_MODEL ?? "openai/gpt-4o-mini"
});

export const triageAgent = new Agent({
  id: agentCatalog.triage.id,
  name: agentCatalog.triage.name,
  instructions: agentCatalog.triage.instructions,
  model: process.env.MASTRA_MODEL ?? "openai/gpt-4o-mini"
});

export const itSupportAgent = new Agent({
  id: agentCatalog["it-support"].id,
  name: agentCatalog["it-support"].name,
  instructions: agentCatalog["it-support"].instructions,
  model: process.env.MASTRA_MODEL ?? "openai/gpt-4o-mini"
});

export const complianceAgent = new Agent({
  id: agentCatalog.compliance.id,
  name: agentCatalog.compliance.name,
  instructions: agentCatalog.compliance.instructions,
  model: process.env.MASTRA_MODEL ?? "openai/gpt-4o-mini"
});

export const mastra = new Mastra({
  agents: {
    supervisorAgent,
    supportAgent,
    triageAgent,
    itSupportAgent,
    complianceAgent
  }
});

export function getMastraRuntimeSummary() {
  return {
    framework: "Mastra",
    registeredAgents: [
      supervisorAgent.name,
      supportAgent.name,
      triageAgent.name,
      itSupportAgent.name,
      complianceAgent.name
    ],
    model: process.env.MASTRA_MODEL ?? "openai/gpt-4o-mini",
    note: "The local REST API uses the provider-agnostic LLM gateway. Mastra agents are registered here so the project can evolve to Mastra server and CopilotKit AG-UI routes."
  };
}
