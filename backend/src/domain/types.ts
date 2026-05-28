export type AgentId = "supervisor" | "support" | "triage" | "it-support" | "compliance";

export type TicketSeverity = "low" | "medium" | "high" | "critical";

export type TicketStatus = "new" | "triaged" | "needs_approval" | "answered";

export type Classification = "public" | "internal" | "confidential" | "restricted";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type OutboxStatus = "pending" | "delivered" | "failed";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  role: string;
  modelHint: string;
  instructions: string;
  tools: string[];
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  index: number;
  tags: string[];
  classification: Classification;
}

export interface DocumentStorageObject {
  provider: "local" | "azure-blob";
  key: string;
  url?: string;
  filename: string;
  contentType: string;
  bytes: number;
  storedAt: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  content: string;
  tags: string[];
  classification: Classification;
  rawStorage?: DocumentStorageObject;
  createdAt: string;
  chunks: DocumentChunk[];
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  customer: string;
  severity: TicketSeverity;
  status: TicketStatus;
  assignedAgent: AgentId;
  createdAt: string;
  updatedAt: string;
}

export interface RetrievedContext {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  score: number;
  tags: string[];
  classification: Classification;
}

export interface SafetyFlag {
  code: string;
  severity: TicketSeverity;
  message: string;
}

export type LlmProvider = "mock" | "litellm" | "google";

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AgentTraceSpan {
  name: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  attributes: Record<string, string | number | boolean>;
}

export interface AgentRunTrace {
  traceId: string;
  provider: LlmProvider;
  workflow: string;
  tools: string[];
  tokenUsage?: TokenUsage;
  spans: AgentTraceSpan[];
}

export interface AgentRun {
  id: string;
  traceId: string;
  agentId: AgentId;
  prompt: string;
  answer: string;
  model: string;
  provider: LlmProvider;
  tokenUsage?: TokenUsage;
  trace: AgentRunTrace;
  latencyMs: number;
  retrievedContext: RetrievedContext[];
  safetyFlags: SafetyFlag[];
  createdAt: string;
}

export interface AgentEvaluation {
  id: string;
  runId: string;
  retrievalScore: number;
  groundednessScore: number;
  safetyScore: number;
  usefulnessScore: number;
  overallScore: number;
  findings: string[];
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  agentId: AgentId;
  status: ApprovalStatus;
  prompt: string;
  answerPreview: string;
  safetyFlags: SafetyFlag[];
  requestedBy: string;
  decidedBy?: string;
  decisionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutboxMessage {
  id: string;
  eventId: string;
  type: AuditEvent["type"];
  status: OutboxStatus;
  payload: AuditEvent;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
}

export interface AuditEvent {
  id: string;
  type:
    | "document.ingested"
    | "ticket.created"
    | "ticket.triaged"
    | "agent.run.started"
    | "agent.run.completed"
    | "agent.evaluation.completed"
    | "approval.required"
    | "approval.approved"
    | "approval.rejected";
  actor: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformMetrics {
  documents: number;
  tickets: number;
  agentRuns: number;
  evaluations: number;
  pendingApprovals: number;
  outboxPending: number;
  outboxFailed: number;
  auditEvents: number;
  tracedRuns: number;
  totalTokens: number;
  averageLatencyMs: number;
  averageQualityScore: number;
  runsByAgent: Record<AgentId, number>;
}
