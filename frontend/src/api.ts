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
  SystemStatus,
  Ticket
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:3333" : "");
const API_KEY_STORAGE_KEY = "agentops.apiKey";
const API_KEY_LEGACY_STORAGE_KEY = "agentops.apiKey";
let volatileApiKey = "";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getStoredApiKey() {
  const sessionValue = readSessionValue(API_KEY_STORAGE_KEY);

  if (sessionValue) {
    volatileApiKey = sessionValue;
    return sessionValue;
  }

  const legacyValue = readLocalValue(API_KEY_LEGACY_STORAGE_KEY);

  if (legacyValue) {
    volatileApiKey = legacyValue;
    writeSessionValue(API_KEY_STORAGE_KEY, legacyValue);
    removeLocalValue(API_KEY_LEGACY_STORAGE_KEY);
  }

  return legacyValue ?? volatileApiKey;
}

function apiKeyHeaders() {
  const apiKey = getStoredApiKey();
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
  const { headers: optionsHeaders, ...restOptions } = options ?? {};
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...restOptions,
    headers: buildHeaders(optionsHeaders)
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new ApiError(message || `Request failed with status ${response.status}`, response.status);
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
    const message = await readErrorMessage(response);
    throw new ApiError(message || `Request failed with status ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

async function readErrorMessage(response: Response) {
  const text = await response.text();

  if (!text) {
    return "";
  }

  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? text;
  } catch {
    return text;
  }
}

export const api = {
  getApiKey() {
    return getStoredApiKey();
  },
  setApiKey(value: string) {
    setStoredApiKey(value);
  },
  async system() {
    return request<{ data: SystemStatus }>("/api/system");
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
  }
};

function setStoredApiKey(value: string) {
  const nextValue = value.trim();
  volatileApiKey = nextValue;
  if (nextValue) {
    writeSessionValue(API_KEY_STORAGE_KEY, nextValue);
  } else {
    removeSessionValue(API_KEY_STORAGE_KEY);
  }
  removeLocalValue(API_KEY_LEGACY_STORAGE_KEY);
}

function readSessionValue(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // In private or locked-down browsers, the API key stays only in React state.
  }
}

function removeSessionValue(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore unavailable browser storage.
  }
}

function readLocalValue(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeLocalValue(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore unavailable browser storage.
  }
}
