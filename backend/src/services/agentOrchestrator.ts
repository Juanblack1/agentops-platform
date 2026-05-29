import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import { agentCatalog, getAgentDefinition } from "../agents/catalog";
import type { AgentId, AgentRun, AgentTraceSpan } from "../domain/types";
import { InMemoryEventBus } from "../events/eventBus";
import { evaluateGovernance, requiresApproval } from "../governance/policies";
import type { LlmGateway } from "../llm/llmGateway";
import { withSpan } from "../observability/tracing";
import { RagService } from "../rag/ragService";
import { InMemoryStore } from "../repositories/inMemoryStore";
import { EvaluationService } from "./evaluationService";

interface RunAgentInput {
  agentId: AgentId;
  prompt: string;
  actor?: string;
}

export class AgentOrchestrator {
  constructor(
    private readonly store: InMemoryStore,
    private readonly rag: RagService,
    private readonly llm: LlmGateway,
    private readonly evaluations: EvaluationService,
    private readonly eventBus: InMemoryEventBus,
    private readonly logger: Logger
  ) {}

  async runAgent(input: RunAgentInput): Promise<AgentRun> {
    return withSpan("agent.run", { "agent.id": input.agentId }, async (span) => {
      const traceId = randomUUID();
      const traceSpans: AgentTraceSpan[] = [];
      const actor = input.actor ?? "local-user";
      const agent = getAgentDefinition(input.agentId);

      const started = this.store.saveAuditEvent({
        type: "agent.run.started",
        actor,
        entityId: input.agentId,
        metadata: {
          traceId,
          promptPreview: input.prompt.slice(0, 180)
        }
      });
      await this.eventBus.publish(started);

      const context = await recordTraceSpan(traceSpans, "rag.retrieve", { topK: 4 }, () => this.rag.retrieve(input.prompt, 4));
      const completion = await recordTraceSpan(traceSpans, "llm.generate", { provider: "gateway", agentId: input.agentId }, () =>
        this.llm.generate({
          agent,
          prompt: input.prompt,
          context
        })
      );
      const safetyFlags = await recordTraceSpan(traceSpans, "governance.evaluate", { contextCount: context.length }, async () =>
        evaluateGovernance(input.prompt, completion.answer, context)
      );
      const toolNames = [...new Set([...agent.tools, "rag.search", "governance.evaluate"])];
      const trace = {
        traceId,
        provider: completion.provider,
        workflow: "agent-run-governance",
        tools: toolNames,
        tokenUsage: completion.tokenUsage,
        spans: traceSpans
      };
      span.setAttribute("trace.id", traceId);
      span.setAttribute("rag.context_count", context.length);
      span.setAttribute("llm.model", completion.model);
      span.setAttribute("llm.provider", completion.provider);
      span.setAttribute("llm.tokens.total", completion.tokenUsage?.totalTokens ?? 0);
      span.setAttribute("governance.flag_count", safetyFlags.length);

      const run = this.store.saveAgentRun({
        traceId,
        agentId: input.agentId,
        prompt: input.prompt,
        answer: completion.answer,
        reasoningSummary: buildReasoningSummary(context, completion.provider, completion.model, safetyFlags),
        model: completion.model,
        provider: completion.provider,
        tokenUsage: completion.tokenUsage,
        trace,
        latencyMs: completion.latencyMs,
        retrievedContext: context,
        safetyFlags
      });

      const completed = this.store.saveAuditEvent({
        type: "agent.run.completed",
        actor,
        entityId: run.id,
        metadata: {
          traceId,
          agentId: input.agentId,
          provider: completion.provider,
          model: completion.model,
          latencyMs: completion.latencyMs,
          tokenUsage: completion.tokenUsage,
          contextCount: context.length,
          safetyFlags: safetyFlags.map((flag) => flag.code)
        }
      });
      await this.eventBus.publish(completed);

      const evaluation = this.store.saveAgentEvaluation(this.evaluations.evaluate(run));
      span.setAttribute("eval.overall_score", evaluation.overallScore);
      const evaluationEvent = this.store.saveAuditEvent({
        type: "agent.evaluation.completed",
        actor: "evaluation-system",
        entityId: evaluation.id,
        metadata: {
          traceId,
          runId: run.id,
          overallScore: evaluation.overallScore,
          retrievalScore: evaluation.retrievalScore,
          groundednessScore: evaluation.groundednessScore,
          safetyScore: evaluation.safetyScore
        }
      });
      await this.eventBus.publish(evaluationEvent);

      if (requiresApproval(safetyFlags)) {
        const approvalRequest = this.store.saveApprovalRequest({
          runId: run.id,
          agentId: run.agentId,
          status: "pending",
          prompt: run.prompt,
          answerPreview: run.answer.slice(0, 600),
          safetyFlags,
          requestedBy: "governance-system"
        });
        const approval = this.store.saveAuditEvent({
          type: "approval.required",
          actor: "governance-system",
          entityId: approvalRequest.id,
          metadata: {
            traceId,
            runId: run.id,
            flags: safetyFlags
          }
        });
        await this.eventBus.publish(approval);
      }

      this.logger.info({ runId: run.id, traceId, agentId: input.agentId }, "agent run completed");
      return run;
    });
  }

  listAgents() {
    return Object.values(agentCatalog);
  }
}

function buildReasoningSummary(
  context: Awaited<ReturnType<RagService["retrieve"]>>,
  provider: AgentRun["provider"],
  model: string,
  safetyFlags: AgentRun["safetyFlags"]
) {
  const summary: string[] = [];
  const mostRelevantContext = context[0];

  if (mostRelevantContext) {
    summary.push(
      `Busquei ${context.length} trecho(s) na base de conhecimento. O mais relevante foi "${mostRelevantContext.title}" (${Math.round(
        mostRelevantContext.score * 100
      )}% de similaridade).`
    );
  } else {
    summary.push("Nao encontrei documentos relevantes na base. A resposta marca essa lacuna quando o contexto interno for insuficiente.");
  }

  summary.push(`Enviei a tarefa para ${providerLabel(provider)} usando o modelo ${model}.`);

  if (safetyFlags.length > 0) {
    summary.push(`A governanca encontrou ${safetyFlags.length} sinal(is) de risco: ${safetyFlags.map((flag) => flag.code).join(", ")}.`);
  } else {
    summary.push("A governanca nao encontrou segredo, credencial ou dado restrito na resposta gerada.");
  }

  summary.push("Registrei trace, tempo, tokens e avaliacao para auditoria.");
  return summary;
}

function providerLabel(provider: AgentRun["provider"]) {
  const labels: Record<AgentRun["provider"], string> = {
    mock: "IA simulada",
    google: "Google Gemini",
    litellm: "LiteLLM"
  };
  return labels[provider];
}

async function recordTraceSpan<T>(
  spans: AgentTraceSpan[],
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>
) {
  const started = performance.now();
  const startedAt = new Date().toISOString();
  try {
    const result = await fn();
    spans.push({
      name,
      startedAt,
      endedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - started),
      attributes: {
        ...attributes,
        status: "ok"
      }
    });
    return result;
  } catch (error) {
    spans.push({
      name,
      startedAt,
      endedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - started),
      attributes: {
        ...attributes,
        status: "error",
        error: error instanceof Error ? error.message : String(error)
      }
    });
    throw error;
  }
}
