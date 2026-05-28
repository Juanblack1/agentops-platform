import type {
  AgentDefinition,
  AgentEvaluation,
  AgentId,
  AgentRun,
  ApprovalRequest,
  AuditEvent,
  DocumentRecord,
  GovernancePolicy,
  OutboxMessage,
  PlatformMetrics,
  Ticket
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3333";
const API_KEY_STORAGE_KEY = "agentops.apiKey";

function apiKeyHeaders() {
  const apiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
  return apiKey ? { "x-api-key": apiKey } : undefined;
}

function buildHeaders(optionsHeaders?: HeadersInit) {
  const headers = new Headers(optionsHeaders);
  headers.set("content-type", "application/json");

  const authHeaders = apiKeyHeaders();
  if (authHeaders) {
    headers.set("x-api-key", authHeaders["x-api-key"]);
  }

  return headers;
}

function buildMultipartHeaders() {
  const headers = new Headers();
  const authHeaders = apiKeyHeaders();

  if (authHeaders) {
    headers.set("x-api-key", authHeaders["x-api-key"]);
  }

  return headers;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: buildHeaders(options?.headers),
    ...options
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function multipartRequest<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body,
    headers: buildMultipartHeaders()
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export const api = {
  getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
  },
  setApiKey(value: string) {
    const nextValue = value.trim();
    if (nextValue) {
      localStorage.setItem(API_KEY_STORAGE_KEY, nextValue);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  },
  async metrics() {
    return request<{ data: PlatformMetrics }>("/api/metrics");
  },
  async agents() {
    return request<{ data: AgentDefinition[] }>("/api/agents");
  },
  async mastra() {
    return request<{
      data: {
        framework: string;
        mode: string;
        registeredAgents: string[];
        registeredTools: string[];
        registeredWorkflows: string[];
        model: string;
        note: string;
        studio: {
          apiCommand: string;
          studioCommand: string;
          apiUrl: string;
          studioUrl: string;
        };
      };
    }>("/api/agents/mastra");
  },
  async documents() {
    return request<{ data: DocumentRecord[] }>("/api/documents");
  },
  async createDocument(payload: {
    title: string;
    content: string;
    tags: string[];
    classification: DocumentRecord["classification"];
  }) {
    return request<{ data: DocumentRecord }>("/api/documents", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async uploadDocument(file: File, payload: { title?: string; tags: string[]; classification: DocumentRecord["classification"] }) {
    const params = new URLSearchParams({
      tags: payload.tags.join(","),
      classification: payload.classification
    });

    if (payload.title) {
      params.set("title", payload.title);
    }

    const body = new FormData();
    body.set("file", file);
    return multipartRequest<{ data: DocumentRecord }>(`/api/documents/upload?${params.toString()}`, body);
  },
  async tickets() {
    return request<{ data: Ticket[] }>("/api/tickets");
  },
  async createTicket(payload: { subject: string; description: string; customer: string }) {
    return request<{ data: Ticket }>("/api/tickets", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async runAgent(agentId: AgentId, prompt: string) {
    return request<{ data: AgentRun }>(`/api/agents/${agentId}/run`, {
      method: "POST",
      body: JSON.stringify({ prompt })
    });
  },
  async agentRuns() {
    return request<{ data: AgentRun[] }>("/api/agent-runs");
  },
  async evaluations() {
    return request<{ data: AgentEvaluation[] }>("/api/evaluations");
  },
  async auditEvents() {
    return request<{ data: AuditEvent[] }>("/api/audit-events");
  },
  async outbox() {
    return request<{ data: OutboxMessage[] }>("/api/outbox");
  },
  async dispatchOutbox(limit = 25) {
    return request<{ data: { scanned: number; delivered: OutboxMessage[]; failed: OutboxMessage[] } }>("/api/outbox/dispatch", {
      method: "POST",
      body: JSON.stringify({ limit })
    });
  },
  async approvals() {
    return request<{ data: ApprovalRequest[] }>("/api/approvals");
  },
  async decideApproval(approvalId: string, payload: { decision: "approved" | "rejected"; actor: string; reason: string }) {
    return request<{ data: ApprovalRequest }>(`/api/approvals/${approvalId}/decision`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async policies() {
    return request<{ data: GovernancePolicy[] }>("/api/governance/policies");
  },
  async seedDemo() {
    return request<{ data: PlatformMetrics }>("/api/demo/seed", {
      method: "POST"
    });
  }
};
