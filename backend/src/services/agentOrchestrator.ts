import type { Logger } from "pino";
import { agentCatalog, getAgentDefinition } from "../agents/catalog";
import type { AgentId, AgentRun } from "../domain/types";
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
      const actor = input.actor ?? "local-user";
      const agent = getAgentDefinition(input.agentId);

      const started = this.store.saveAuditEvent({
        type: "agent.run.started",
        actor,
        entityId: input.agentId,
        metadata: {
          promptPreview: input.prompt.slice(0, 180)
        }
      });
      await this.eventBus.publish(started);

      const context = await this.rag.retrieve(input.prompt, 4);
      const completion = await this.llm.generate({
        agent,
        prompt: input.prompt,
        context
      });
      const safetyFlags = evaluateGovernance(input.prompt, completion.answer, context);
      span.setAttribute("rag.context_count", context.length);
      span.setAttribute("llm.model", completion.model);
      span.setAttribute("governance.flag_count", safetyFlags.length);

      const run = this.store.saveAgentRun({
        agentId: input.agentId,
        prompt: input.prompt,
        answer: completion.answer,
        model: completion.model,
        latencyMs: completion.latencyMs,
        retrievedContext: context,
        safetyFlags
      });

      const completed = this.store.saveAuditEvent({
        type: "agent.run.completed",
        actor,
        entityId: run.id,
        metadata: {
          agentId: input.agentId,
          model: completion.model,
          latencyMs: completion.latencyMs,
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
            runId: run.id,
            flags: safetyFlags
          }
        });
        await this.eventBus.publish(approval);
      }

      this.logger.info({ runId: run.id, agentId: input.agentId }, "agent run completed");
      return run;
    });
  }

  listAgents() {
    return Object.values(agentCatalog);
  }
}
