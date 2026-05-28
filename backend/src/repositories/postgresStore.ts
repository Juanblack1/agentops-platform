import { Pool } from "pg";
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

const EMPTY_SNAPSHOT: StoreSnapshot = {
  schemaVersion: 1,
  documents: [],
  tickets: [],
  agentRuns: [],
  evaluations: [],
  approvalRequests: [],
  auditEvents: [],
  outboxMessages: []
};

export class PostgresSnapshotStore extends InMemoryStore {
  private persistChain = Promise.resolve();

  private constructor(private readonly pool: Pool) {
    super();
  }

  static async create(connectionString: string) {
    const pool = new Pool({ connectionString });
    const store = new PostgresSnapshotStore(pool);
    await store.migrate();
    await store.loadSnapshot();
    return store;
  }

  override saveDocument(document: Omit<DocumentRecord, "id" | "createdAt"> & { id?: string }) {
    const record = super.saveDocument(document);
    this.schedulePersist();
    return record;
  }

  override saveTicket(ticket: Omit<Ticket, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
    const record = super.saveTicket(ticket);
    this.schedulePersist();
    return record;
  }

  override updateTicket(ticket: Ticket) {
    const record = super.updateTicket(ticket);
    this.schedulePersist();
    return record;
  }

  override saveAgentRun(run: Omit<AgentRun, "id" | "createdAt">) {
    const record = super.saveAgentRun(run);
    this.schedulePersist();
    return record;
  }

  override saveAgentEvaluation(evaluation: Omit<AgentEvaluation, "id" | "createdAt">) {
    const record = super.saveAgentEvaluation(evaluation);
    this.schedulePersist();
    return record;
  }

  override saveApprovalRequest(approval: Omit<ApprovalRequest, "id" | "createdAt" | "updatedAt">) {
    const record = super.saveApprovalRequest(approval);
    this.schedulePersist();
    return record;
  }

  override updateApprovalRequest(approval: ApprovalRequest) {
    const record = super.updateApprovalRequest(approval);
    this.schedulePersist();
    return record;
  }

  override saveAuditEvent(event: Omit<AuditEvent, "id" | "createdAt">) {
    const record = super.saveAuditEvent(event);
    this.schedulePersist();
    return record;
  }

  override saveOutboxMessage(message: Omit<OutboxMessage, "id" | "createdAt" | "updatedAt" | "attempts" | "status">) {
    const record = super.saveOutboxMessage(message);
    this.schedulePersist();
    return record;
  }

  override updateOutboxMessage(message: OutboxMessage) {
    const record = super.updateOutboxMessage(message);
    this.schedulePersist();
    return record;
  }

  override replaceWithSnapshot(snapshot: StoreSnapshot) {
    super.replaceWithSnapshot(snapshot);
    this.schedulePersist();
  }

  async flush() {
    await this.persistChain;
  }

  async close() {
    await this.flush();
    await this.pool.end();
  }

  private async migrate() {
    await this.pool.query(`
      create table if not exists agentops_snapshots (
        id text primary key,
        schema_version integer not null,
        payload jsonb not null,
        updated_at timestamptz not null default now()
      );
    `);

    await this.pool.query(`
      insert into agentops_snapshots (id, schema_version, payload)
      values ('default', 1, $1::jsonb)
      on conflict (id) do nothing;
    `, [JSON.stringify(EMPTY_SNAPSHOT)]);
  }

  private async loadSnapshot() {
    const result = await this.pool.query<{ payload: StoreSnapshot }>(
      "select payload from agentops_snapshots where id = 'default'"
    );
    super.replaceWithSnapshot(result.rows[0]?.payload ?? EMPTY_SNAPSHOT);
  }

  private schedulePersist() {
    this.persistChain = this.persistChain.then(() => this.persist()).catch(() => this.persist());
  }

  private async persist() {
    await this.pool.query(
      `
        update agentops_snapshots
        set payload = $1::jsonb,
            schema_version = 1,
            updated_at = now()
        where id = 'default';
      `,
      [JSON.stringify(this.exportSnapshot())]
    );
  }
}
