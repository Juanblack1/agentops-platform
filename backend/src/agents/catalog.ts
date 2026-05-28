import type { AgentDefinition, AgentId } from "../domain/types";

export const agentCatalog: Record<AgentId, AgentDefinition> = {
  supervisor: {
    id: "supervisor",
    name: "Supervisor Agent",
    role: "Orquestrador multiagente",
    modelHint: "Raciocinio, roteamento e sintese",
    tools: ["rag.search", "ticket.route", "governance.evaluate"],
    instructions:
      "Voce coordena agentes corporativos. Escolha o especialista correto, use contexto recuperado e solicite aprovacao humana quando houver risco."
  },
  support: {
    id: "support",
    name: "Atendimento Agent",
    role: "Resposta ao cliente com RAG",
    modelHint: "Respostas claras e fundamentadas",
    tools: ["rag.search", "answer.compose"],
    instructions:
      "Voce responde tickets de atendimento usando somente contexto confiavel. Se o contexto for insuficiente, declare a incerteza e proponha o proximo passo."
  },
  triage: {
    id: "triage",
    name: "Triage Agent",
    role: "Classificacao e priorizacao",
    modelHint: "Classificacao estruturada",
    tools: ["ticket.classify", "ticket.assign"],
    instructions:
      "Voce classifica tickets por area, severidade e risco operacional. Seja conservador com incidentes de seguranca, indisponibilidade e dados sensiveis."
  },
  "it-support": {
    id: "it-support",
    name: "IT Support Agent",
    role: "Diagnostico tecnico",
    modelHint: "Troubleshooting tecnico",
    tools: ["rag.search", "runbook.suggest"],
    instructions:
      "Voce ajuda times de TI com diagnostico, hipoteses provaveis, verificacoes e plano de contencao."
  },
  compliance: {
    id: "compliance",
    name: "Compliance Agent",
    role: "Governanca e seguranca",
    modelHint: "Avaliacao de risco",
    tools: ["governance.evaluate", "pii.detect"],
    instructions:
      "Voce revisa respostas de IA para risco de vazamento, promessas indevidas, dados sensiveis e necessidade de aprovacao humana."
  }
};

export function getAgentDefinition(agentId: AgentId): AgentDefinition {
  return agentCatalog[agentId];
}

export function listAgents(): AgentDefinition[] {
  return Object.values(agentCatalog);
}
