import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type {
  AgentEvaluation,
  AgentRun,
  ApprovalRequest,
  AuditEvent,
  DocumentRecord,
  OutboxMessage,
  Ticket
} from "../domain/types";
import { InMemoryStore, type StoreSnapshot } from "./inMemoryStore";

const StoreSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  documents: z.array(z.unknown()).default([]),
  tickets: z.array(z.unknown()).default([]),
  agentRuns: z.array(z.unknown()).default([]),
  evaluations: z.array(z.unknown()).default([]),
  approvalRequests: z.array(z.unknown()).default([]),
  auditEvents: z.array(z.unknown()).default([]),
  outboxMessages: z.array(z.unknown()).default([])
});

export class PersistentStore extends InMemoryStore {
  readonly filePath: string;

  constructor(filePath: string) {
    super();
    this.filePath = resolve(filePath);
    this.loadFromDisk();
  }

  override saveDocument(document: Omit<DocumentRecord, "id" | "createdAt"> & { id?: string }) {
    const record = super.saveDocument(document);
    this.persist();
    return record;
  }

  override saveTicket(ticket: Omit<Ticket, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
    const record = super.saveTicket(ticket);
    this.persist();
    return record;
  }

  override updateTicket(ticket: Ticket) {
    const record = super.updateTicket(ticket);
    this.persist();
    return record;
  }

  override saveAgentRun(run: Omit<AgentRun, "id" | "createdAt">) {
    const record = super.saveAgentRun(run);
    this.persist();
    return record;
  }

  override saveAgentEvaluation(evaluation: Omit<AgentEvaluation, "id" | "createdAt">) {
    const record = super.saveAgentEvaluation(evaluation);
    this.persist();
    return record;
  }

  override saveApprovalRequest(approval: Omit<ApprovalRequest, "id" | "createdAt" | "updatedAt">) {
    const record = super.saveApprovalRequest(approval);
    this.persist();
    return record;
  }

  override updateApprovalRequest(approval: ApprovalRequest) {
    const record = super.updateApprovalRequest(approval);
    this.persist();
    return record;
  }

  override saveAuditEvent(event: Omit<AuditEvent, "id" | "createdAt">) {
    const record = super.saveAuditEvent(event);
    this.persist();
    return record;
  }

  override saveOutboxMessage(message: Omit<OutboxMessage, "id" | "createdAt" | "updatedAt" | "attempts" | "status">) {
    const record = super.saveOutboxMessage(message);
    this.persist();
    return record;
  }

  override updateOutboxMessage(message: OutboxMessage) {
    const record = super.updateOutboxMessage(message);
    this.persist();
    return record;
  }

  override markOutboxDelivered(id: string) {
    const record = super.markOutboxDelivered(id);
    this.persist();
    return record;
  }

  override markOutboxFailed(id: string, error: string) {
    const record = super.markOutboxFailed(id, error);
    this.persist();
    return record;
  }

  override replaceWithSnapshot(snapshot: StoreSnapshot) {
    super.replaceWithSnapshot(snapshot);
    this.persist();
  }

  private loadFromDisk() {
    if (!existsSync(this.filePath)) {
      return;
    }

    const raw = readFileSync(this.filePath, "utf8");
    const parsed = StoreSnapshotSchema.parse(JSON.parse(raw));
    super.replaceWithSnapshot(parsed as StoreSnapshot);
  }

  private persist() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(this.exportSnapshot(), null, 2)}\n`, "utf8");
    renameSync(tempPath, this.filePath);
  }
}
