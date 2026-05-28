import { randomUUID } from "node:crypto";
import type {
  AgentEvaluation,
  AgentId,
  AgentRun,
  ApprovalRequest,
  AuditEvent,
  DocumentRecord,
  OutboxMessage,
  PlatformMetrics,
  Ticket
} from "../domain/types";

export interface StoreSnapshot {
  schemaVersion: 1;
  documents: DocumentRecord[];
  tickets: Ticket[];
  agentRuns: AgentRun[];
  evaluations: AgentEvaluation[];
  approvalRequests: ApprovalRequest[];
  auditEvents: AuditEvent[];
  outboxMessages: OutboxMessage[];
}

export class InMemoryStore {
  protected readonly documents = new Map<string, DocumentRecord>();
  protected readonly tickets = new Map<string, Ticket>();
  protected readonly agentRuns = new Map<string, AgentRun>();
  protected readonly evaluations = new Map<string, AgentEvaluation>();
  protected readonly approvalRequests = new Map<string, ApprovalRequest>();
  protected readonly auditEvents = new Map<string, AuditEvent>();
  protected readonly outboxMessages = new Map<string, OutboxMessage>();

  exportSnapshot(): StoreSnapshot {
    return {
      schemaVersion: 1,
      documents: this.listDocuments(),
      tickets: this.listTickets(),
      agentRuns: this.listAgentRuns(),
      evaluations: this.listAgentEvaluations(),
      approvalRequests: this.listApprovalRequests(),
      auditEvents: this.listAuditEvents(),
      outboxMessages: this.listOutboxMessages()
    };
  }

  replaceWithSnapshot(snapshot: StoreSnapshot) {
    this.documents.clear();
    this.tickets.clear();
    this.agentRuns.clear();
    this.evaluations.clear();
    this.approvalRequests.clear();
    this.auditEvents.clear();
    this.outboxMessages.clear();

    for (const document of snapshot.documents) this.documents.set(document.id, document);
    for (const ticket of snapshot.tickets) this.tickets.set(ticket.id, ticket);
    for (const run of snapshot.agentRuns) this.agentRuns.set(run.id, normalizeAgentRun(run));
    for (const evaluation of snapshot.evaluations) this.evaluations.set(evaluation.id, evaluation);
    for (const approval of snapshot.approvalRequests) this.approvalRequests.set(approval.id, approval);
    for (const event of snapshot.auditEvents) this.auditEvents.set(event.id, event);
    for (const message of snapshot.outboxMessages) this.outboxMessages.set(message.id, message);
  }

  saveDocument(document: Omit<DocumentRecord, "id" | "createdAt"> & { id?: string }) {
    const record: DocumentRecord = {
      ...document,
      id: document.id ?? randomUUID(),
      createdAt: new Date().toISOString()
    };
    this.documents.set(record.id, record);
    return record;
  }

  listDocuments() {
    return [...this.documents.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findDocument(id: string) {
    return this.documents.get(id);
  }

  saveTicket(ticket: Omit<Ticket, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
    const now = new Date().toISOString();
    const record: Ticket = {
      ...ticket,
      id: ticket.id ?? randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    this.tickets.set(record.id, record);
    return record;
  }

  updateTicket(ticket: Ticket) {
    const updated = {
      ...ticket,
      updatedAt: new Date().toISOString()
    };
    this.tickets.set(updated.id, updated);
    return updated;
  }

  listTickets() {
    return [...this.tickets.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  saveAgentRun(run: Omit<AgentRun, "id" | "createdAt">) {
    const record: AgentRun = {
      ...run,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };
    this.agentRuns.set(record.id, record);
    return record;
  }

  listAgentRuns() {
    return [...this.agentRuns.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findAgentRun(id: string) {
    return this.agentRuns.get(id);
  }

  saveAgentEvaluation(evaluation: Omit<AgentEvaluation, "id" | "createdAt">) {
    const record: AgentEvaluation = {
      ...evaluation,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };
    this.evaluations.set(record.id, record);
    return record;
  }

  listAgentEvaluations() {
    return [...this.evaluations.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findEvaluationByRunId(runId: string) {
    return this.listAgentEvaluations().find((evaluation) => evaluation.runId === runId);
  }

  saveApprovalRequest(approval: Omit<ApprovalRequest, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const record: ApprovalRequest = {
      ...approval,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    this.approvalRequests.set(record.id, record);
    return record;
  }

  updateApprovalRequest(approval: ApprovalRequest) {
    const updated = {
      ...approval,
      updatedAt: new Date().toISOString()
    };
    this.approvalRequests.set(updated.id, updated);
    return updated;
  }

  findApprovalRequest(id: string) {
    return this.approvalRequests.get(id);
  }

  listApprovalRequests() {
    return [...this.approvalRequests.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  saveAuditEvent(event: Omit<AuditEvent, "id" | "createdAt">) {
    const record: AuditEvent = {
      ...event,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };
    this.auditEvents.set(record.id, record);
    this.saveOutboxMessage({
      eventId: record.id,
      type: record.type,
      payload: record
    });
    return record;
  }

  listAuditEvents() {
    return [...this.auditEvents.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  saveOutboxMessage(message: Omit<OutboxMessage, "id" | "createdAt" | "updatedAt" | "attempts" | "status">) {
    const now = new Date().toISOString();
    const record: OutboxMessage = {
      ...message,
      id: randomUUID(),
      attempts: 0,
      status: "pending",
      createdAt: now,
      updatedAt: now
    };
    this.outboxMessages.set(record.id, record);
    return record;
  }

  updateOutboxMessage(message: OutboxMessage) {
    const updated = {
      ...message,
      updatedAt: new Date().toISOString()
    };
    this.outboxMessages.set(updated.id, updated);
    return updated;
  }

  listOutboxMessages() {
    return [...this.outboxMessages.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listPendingOutboxMessages() {
    return this.listOutboxMessages().filter((message) => message.status === "pending");
  }

  markOutboxDelivered(id: string) {
    const message = this.outboxMessages.get(id);
    if (!message) {
      return undefined;
    }

    return this.updateOutboxMessage({
      ...message,
      status: "delivered",
      attempts: message.attempts + 1,
      deliveredAt: new Date().toISOString(),
      lastError: undefined
    });
  }

  markOutboxFailed(id: string, error: string) {
    const message = this.outboxMessages.get(id);
    if (!message) {
      return undefined;
    }

    return this.updateOutboxMessage({
      ...message,
      status: "failed",
      attempts: message.attempts + 1,
      lastError: error
    });
  }

  metrics(): PlatformMetrics {
    const runs = this.listAgentRuns();
    const evaluations = this.listAgentEvaluations();
    const runsByAgent = runs.reduce(
      (acc, run) => {
        acc[run.agentId] += 1;
        return acc;
      },
      {
        supervisor: 0,
        support: 0,
        triage: 0,
        "it-support": 0,
        compliance: 0
      } satisfies Record<AgentId, number>
    );

    const averageLatencyMs =
      runs.length === 0 ? 0 : Math.round(runs.reduce((total, run) => total + run.latencyMs, 0) / runs.length);
    const averageQualityScore =
      evaluations.length === 0
        ? 0
        : Math.round(evaluations.reduce((total, evaluation) => total + evaluation.overallScore, 0) / evaluations.length);
    const totalTokens = runs.reduce((total, run) => total + (run.tokenUsage?.totalTokens ?? 0), 0);

    return {
      documents: this.documents.size,
      tickets: this.tickets.size,
      agentRuns: this.agentRuns.size,
      evaluations: this.evaluations.size,
      pendingApprovals: this.listApprovalRequests().filter((approval) => approval.status === "pending").length,
      outboxPending: this.listOutboxMessages().filter((message) => message.status === "pending").length,
      outboxFailed: this.listOutboxMessages().filter((message) => message.status === "failed").length,
      auditEvents: this.auditEvents.size,
      tracedRuns: runs.filter((run) => Boolean(run.traceId)).length,
      totalTokens,
      averageLatencyMs,
      averageQualityScore,
      runsByAgent
    };
  }
}

function normalizeAgentRun(run: AgentRun): AgentRun {
  if (run.traceId && run.provider && run.trace) {
    return run;
  }

  const traceId = run.traceId ?? run.id;
  const provider = run.provider ?? "mock";

  return {
    ...run,
    traceId,
    provider,
    trace: run.trace ?? {
      traceId,
      provider,
      workflow: "legacy-agent-run",
      tools: [],
      tokenUsage: run.tokenUsage,
      spans: []
    }
  };
}
