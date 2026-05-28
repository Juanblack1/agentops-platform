import { InMemoryEventBus } from "../events/eventBus";
import { InMemoryStore } from "../repositories/inMemoryStore";

interface DecideApprovalInput {
  approvalId: string;
  decision: "approved" | "rejected";
  actor: string;
  reason: string;
}

export class ApprovalService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly eventBus: InMemoryEventBus
  ) {}

  async decide(input: DecideApprovalInput) {
    const approval = this.store.findApprovalRequest(input.approvalId);

    if (!approval) {
      return {
        status: "not_found" as const,
        approval: null
      };
    }

    if (approval.status !== "pending") {
      return {
        status: "already_decided" as const,
        approval
      };
    }

    const updated = this.store.updateApprovalRequest({
      ...approval,
      status: input.decision,
      decidedBy: input.actor,
      decisionReason: input.reason
    });

    const event = this.store.saveAuditEvent({
      type: input.decision === "approved" ? "approval.approved" : "approval.rejected",
      actor: input.actor,
      entityId: approval.id,
      metadata: {
        runId: approval.runId,
        reason: input.reason
      }
    });
    await this.eventBus.publish(event);

    return {
      status: "decided" as const,
      approval: updated
    };
  }
}
