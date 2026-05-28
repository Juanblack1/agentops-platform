export type AgentId = "supervisor" | "support" | "triage" | "it-support" | "compliance";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  role: string;
  modelHint: string;
  instructions: string;
  tools: string[];
}

export interface DocumentRecord {
  id: string;
  title: string;
  content: string;
  tags: string[];
  classification: "public" | "internal" | "confidential" | "restricted";
  rawStorage?: {
    provider: "local" | "azure-blob";
    key: string;
    url?: string;
    filename: string;
    contentType: string;
    bytes: number;
    storedAt: string;
  };
  createdAt: string;
  chunks: Array<{ id: string; content: string }>;
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  customer: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "new" | "triaged" | "needs_approval" | "answered";
  assignedAgent: AgentId;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  traceId: string;
  agentId: AgentId;
  prompt: string;
  answer: string;
  model: string;
  provider: "mock" | "litellm" | "google";
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  trace: {
    traceId: string;
    provider: "mock" | "litellm" | "google";
    workflow: string;
    tools: string[];
    spans: Array<{
      name: string;
      durationMs: number;
      attributes: Record<string, string | number | boolean>;
    }>;
  };
  latencyMs: number;
  retrievedContext: Array<{
    title: string;
    content: string;
    score: number;
    classification: string;
  }>;
  safetyFlags: Array<{
    code: string;
    severity: string;
    message: string;
  }>;
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
  status: "pending" | "approved" | "rejected";
  prompt: string;
  answerPreview: string;
  safetyFlags: Array<{
    code: string;
    severity: string;
    message: string;
  }>;
  requestedBy: string;
  decidedBy?: string;
  decisionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutboxMessage {
  id: string;
  eventId: string;
  type: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
}

export interface AuditEvent {
  id: string;
  type: string;
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

export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
}

export interface SystemStatus {
  nodeEnv: string;
  authRequired: boolean;
  dataStore: string;
  llmProvider: string;
  llmModel: string;
  vectorStore: string;
  qdrantCollection: string;
}
