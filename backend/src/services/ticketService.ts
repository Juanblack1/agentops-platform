import type { Ticket } from "../domain/types";
import { InMemoryEventBus } from "../events/eventBus";
import { InMemoryStore } from "../repositories/inMemoryStore";
import { runTriageWorkflow } from "../workflows/triageWorkflow";

interface CreateTicketInput {
  subject: string;
  description: string;
  customer: string;
  actor?: string;
}

export class TicketService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly eventBus: InMemoryEventBus
  ) {}

  async createTicket(input: CreateTicketInput): Promise<Ticket> {
    const ticket = this.store.saveTicket({
      subject: input.subject,
      description: input.description,
      customer: input.customer,
      severity: "low",
      status: "new",
      assignedAgent: "triage"
    });

    const created = this.store.saveAuditEvent({
      type: "ticket.created",
      actor: input.actor ?? "local-user",
      entityId: ticket.id,
      metadata: {
        subject: ticket.subject,
        customer: ticket.customer
      }
    });
    await this.eventBus.publish(created);

    const decision = runTriageWorkflow(ticket);
    const triaged = this.store.updateTicket({
      ...ticket,
      severity: decision.severity,
      status: decision.status,
      assignedAgent: decision.assignedAgent
    });

    const triageEvent = this.store.saveAuditEvent({
      type: "ticket.triaged",
      actor: "triage-workflow",
      entityId: triaged.id,
      metadata: {
        decision
      }
    });
    await this.eventBus.publish(triageEvent);

    return triaged;
  }
}
