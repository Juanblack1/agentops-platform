import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { createTool } from "@mastra/core/tools";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod/v3";
import { agentCatalog } from "../src/agents/catalog";
import { evaluateGovernance } from "../src/governance/policies";
import { runTriageWorkflow } from "../src/workflows/triageWorkflow";

const model = process.env.MASTRA_MODEL ?? "google/gemini-2.5-flash";

const classificationSchema = z.enum(["public", "internal", "confidential", "restricted"]);
const agentIdSchema = z.enum(["supervisor", "support", "triage", "it-support", "compliance"]);
const severitySchema = z.enum(["low", "medium", "high", "critical"]);
const ticketStatusSchema = z.enum(["new", "triaged", "needs_approval", "answered"]);

const contextSchema = z.object({
  title: z.string(),
  content: z.string(),
  score: z.number(),
  classification: classificationSchema
});

const studioKnowledgeBase = [
  {
    title: "Runbook de incidentes P1",
    content:
      "Incidentes criticos exigem classificacao P1, acionamento do time de TI, validacao de gateway, filas e banco de dados, e comunicacao objetiva aos stakeholders.",
    classification: "internal" as const,
    tags: ["incidente", "p1", "ti"]
  },
  {
    title: "Politica de dados sensiveis",
    content:
      "Solicitacoes envolvendo senha, token, credencial, API key ou dados pessoais devem passar por revisao humana antes de resposta externa.",
    classification: "restricted" as const,
    tags: ["seguranca", "lgpd", "governanca"]
  },
  {
    title: "Atendimento com RAG",
    content:
      "Respostas ao cliente devem citar apenas contexto recuperado. Quando o contexto for insuficiente, a resposta precisa declarar a lacuna e propor proximo passo.",
    classification: "internal" as const,
    tags: ["atendimento", "rag"]
  }
];

export const ragSearchTool = createTool({
  id: "rag.search",
  description: "Busca trechos de conhecimento interno para fundamentar respostas de agentes.",
  inputSchema: z.object({
    query: z.string().min(3),
    topK: z.number().int().min(1).max(5)
  }),
  outputSchema: z.object({
    results: z.array(contextSchema)
  }),
  execute: async (input) => ({
    results: searchStudioKnowledge(input.query, input.topK)
  })
});

export const ticketClassifyTool = createTool({
  id: "ticket.classify",
  description: "Classifica severidade, status e agente responsavel por um ticket corporativo.",
  inputSchema: z.object({
    subject: z.string().min(3),
    description: z.string().min(10)
  }),
  outputSchema: z.object({
    severity: severitySchema,
    assignedAgent: agentIdSchema,
    status: ticketStatusSchema,
    rationale: z.string()
  }),
  execute: async (input) => runTriageWorkflow(input)
});

export const governanceEvaluateTool = createTool({
  id: "governance.evaluate",
  description: "Avalia risco de resposta de IA, dados sensiveis e necessidade de aprovacao humana.",
  inputSchema: z.object({
    prompt: z.string().min(3),
    answer: z.string().min(1),
    contexts: z.array(contextSchema)
  }),
  outputSchema: z.object({
    flags: z.array(
      z.object({
        code: z.string(),
        severity: severitySchema,
        message: z.string()
      })
    ),
    requiresApproval: z.boolean()
  }),
  execute: async (input) => {
    const flags = evaluateGovernance(
      input.prompt,
      input.answer,
      input.contexts.map((context, index) => ({
        chunkId: `studio-${index}`,
        documentId: `studio-${index}`,
        title: context.title,
        content: context.content,
        score: context.score,
        tags: [],
        classification: context.classification
      }))
    );

    return {
      flags,
      requiresApproval: flags.some((flag) => flag.severity === "high" || flag.severity === "critical")
    };
  }
});

export const answerComposeTool = createTool({
  id: "answer.compose",
  description: "Monta uma resposta operacional curta usando contexto recuperado.",
  inputSchema: z.object({
    prompt: z.string().min(3),
    contexts: z.array(contextSchema)
  }),
  outputSchema: z.object({
    draft: z.string(),
    contextCount: z.number()
  }),
  execute: async (input) => ({
    draft:
      input.contexts.length === 0
        ? "Nao encontrei contexto suficiente. Recomendo registrar a lacuna e acionar o especialista responsavel."
        : `Com base em ${input.contexts.length} contexto(s), responda de forma objetiva, cite a politica aplicavel e registre o proximo passo operacional.`,
    contextCount: input.contexts.length
  })
});

export const runbookSuggestTool = createTool({
  id: "runbook.suggest",
  description: "Sugere um runbook de contencao para incidentes de TI.",
  inputSchema: z.object({
    symptom: z.string().min(3)
  }),
  outputSchema: z.object({
    severityHint: severitySchema,
    checklist: z.array(z.string())
  }),
  execute: async (input) => {
    const critical = /(fora|indispon|queda|timeout|critico|p1)/i.test(input.symptom);
    return {
      severityHint: critical ? "critical" : "medium",
      checklist: [
        "Confirmar impacto e horario de inicio.",
        "Validar gateway, filas, banco de dados e integracoes externas.",
        "Registrar owner, status e proxima atualizacao na trilha de auditoria."
      ]
    };
  }
});

export const piiDetectTool = createTool({
  id: "pii.detect",
  description: "Detecta referencias a segredos, credenciais e dados pessoais em prompts ou respostas.",
  inputSchema: z.object({
    text: z.string().min(3)
  }),
  outputSchema: z.object({
    found: z.boolean(),
    indicators: z.array(z.string())
  }),
  execute: async (input) => {
    const indicators = ["senha", "token", "api key", "cpf", "lgpd", "credencial"].filter((term) =>
      input.text.toLowerCase().includes(term)
    );

    return {
      found: indicators.length > 0,
      indicators
    };
  }
});

const mastraTools = {
  ragSearch: ragSearchTool,
  ticketClassify: ticketClassifyTool,
  governanceEvaluate: governanceEvaluateTool,
  answerCompose: answerComposeTool,
  runbookSuggest: runbookSuggestTool,
  piiDetect: piiDetectTool
};

export const supportAgent = new Agent({
  id: agentCatalog.support.id,
  name: agentCatalog.support.name,
  instructions: agentCatalog.support.instructions,
  model,
  tools: {
    ragSearch: ragSearchTool,
    answerCompose: answerComposeTool
  }
});

export const triageAgent = new Agent({
  id: agentCatalog.triage.id,
  name: agentCatalog.triage.name,
  instructions: agentCatalog.triage.instructions,
  model,
  tools: {
    ticketClassify: ticketClassifyTool
  }
});

export const itSupportAgent = new Agent({
  id: agentCatalog["it-support"].id,
  name: agentCatalog["it-support"].name,
  instructions: agentCatalog["it-support"].instructions,
  model,
  tools: {
    ragSearch: ragSearchTool,
    runbookSuggest: runbookSuggestTool
  }
});

export const complianceAgent = new Agent({
  id: agentCatalog.compliance.id,
  name: agentCatalog.compliance.name,
  instructions: agentCatalog.compliance.instructions,
  model,
  tools: {
    governanceEvaluate: governanceEvaluateTool,
    piiDetect: piiDetectTool
  }
});

export const supervisorAgent = new Agent({
  id: agentCatalog.supervisor.id,
  name: agentCatalog.supervisor.name,
  instructions: agentCatalog.supervisor.instructions,
  model,
  tools: {
    ragSearch: ragSearchTool,
    ticketClassify: ticketClassifyTool,
    governanceEvaluate: governanceEvaluateTool
  }
});

const triageWorkflowInputSchema = z.object({
  subject: z.string().min(3),
  description: z.string().min(10)
});

const triageWorkflowOutputSchema = z.object({
  severity: severitySchema,
  assignedAgent: agentIdSchema,
  status: ticketStatusSchema,
  rationale: z.string(),
  requiresApproval: z.boolean()
});

const classifyTicketStep = createStep({
  id: "classify-ticket",
  inputSchema: triageWorkflowInputSchema,
  outputSchema: triageWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const decision = runTriageWorkflow(inputData);
    return {
      ...decision,
      requiresApproval: decision.status === "needs_approval" || decision.severity === "critical"
    };
  }
});

export const ticketTriageWorkflow = createWorkflow({
  id: "ticket-triage-workflow",
  description: "Workflow SDD de triagem com classificacao, roteamento e sinalizacao de aprovacao humana.",
  inputSchema: triageWorkflowInputSchema,
  outputSchema: triageWorkflowOutputSchema
})
  .then(classifyTicketStep)
  .commit();

export const mastra = new Mastra({
  agents: {
    supervisorAgent,
    supportAgent,
    triageAgent,
    itSupportAgent,
    complianceAgent
  },
  tools: mastraTools,
  workflows: {
    ticketTriageWorkflow
  }
});

export function getMastraRuntimeSummary() {
  return {
    framework: "Mastra",
    mode: "registered-runtime",
    studio: {
      apiCommand: "npm run mastra:dev -w backend",
      studioCommand: "npm run mastra:studio -w backend",
      apiUrl: "http://localhost:4111",
      studioUrl: "http://localhost:3001"
    },
    registeredAgents: [
      supervisorAgent.name,
      supportAgent.name,
      triageAgent.name,
      itSupportAgent.name,
      complianceAgent.name
    ],
    registeredTools: Object.values(mastraTools).map((tool) => tool.id),
    registeredWorkflows: [ticketTriageWorkflow.id],
    model,
    note:
      "Mastra registra agentes, tools e workflow para Studio. A API Fastify continua como runtime corporativo com RAG, auditoria, RBAC e outbox."
  };
}

function searchStudioKnowledge(query: string, topK: number) {
  const terms = new Set(
    query
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  );

  return studioKnowledgeBase
    .map((item) => {
      const searchable = `${item.title} ${item.content} ${item.tags.join(" ")}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const matches = [...terms].filter((term) => searchable.includes(term)).length;

      return {
        title: item.title,
        content: item.content,
        classification: item.classification,
        score: Number((matches / Math.max(terms.size, 1)).toFixed(4))
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}
