import {
  Activity,
  Bot,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Cloud,
  Database,
  FileText,
  Play,
  RefreshCcw,
  ShieldCheck,
  Siren,
  Workflow,
  XCircle
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "./api";
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

type View = "command" | "knowledge" | "tickets" | "agents" | "approvals" | "audit" | "azure";

const emptyMetrics: PlatformMetrics = {
  documents: 0,
  tickets: 0,
  agentRuns: 0,
  evaluations: 0,
  pendingApprovals: 0,
  outboxPending: 0,
  outboxFailed: 0,
  auditEvents: 0,
  averageLatencyMs: 0,
  averageQualityScore: 0,
  runsByAgent: {
    supervisor: 0,
    support: 0,
    triage: 0,
    "it-support": 0,
    compliance: 0
  }
};

const views: Array<{ id: View; label: string; icon: typeof Activity }> = [
  { id: "command", label: "Comando", icon: Activity },
  { id: "knowledge", label: "RAG", icon: Database },
  { id: "tickets", label: "Tickets", icon: ClipboardList },
  { id: "agents", label: "Agentes", icon: Bot },
  { id: "approvals", label: "Aprovar", icon: ShieldCheck },
  { id: "audit", label: "Auditoria", icon: ShieldCheck },
  { id: "azure", label: "Azure", icon: Cloud }
];

export default function App() {
  const [activeView, setActiveView] = useState<View>("command");
  const [metrics, setMetrics] = useState<PlatformMetrics>(emptyMetrics);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [evaluations, setEvaluations] = useState<AgentEvaluation[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [outboxMessages, setOutboxMessages] = useState<OutboxMessage[]>([]);
  const [policies, setPolicies] = useState<GovernancePolicy[]>([]);
  const [mastra, setMastra] = useState<{ registeredAgents: string[]; model: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [
        metricsResponse,
        agentsResponse,
        documentsResponse,
        ticketsResponse,
        runsResponse,
        evaluationsResponse,
        approvalsResponse,
        auditResponse,
        outboxResponse,
        policiesResponse,
        mastraResponse
      ] =
        await Promise.all([
          api.metrics(),
          api.agents(),
          api.documents(),
          api.tickets(),
          api.agentRuns(),
          api.evaluations(),
          api.approvals(),
          api.auditEvents(),
          api.outbox(),
          api.policies(),
          api.mastra()
        ]);

      setMetrics(metricsResponse.data);
      setAgents(agentsResponse.data);
      setDocuments(documentsResponse.data);
      setTickets(ticketsResponse.data);
      setRuns(runsResponse.data);
      setEvaluations(evaluationsResponse.data);
      setApprovals(approvalsResponse.data);
      setAuditEvents(auditResponse.data);
      setOutboxMessages(outboxResponse.data);
      setPolicies(policiesResponse.data);
      setMastra(mastraResponse.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const criticalTickets = useMemo(() => tickets.filter((ticket) => ticket.severity === "critical").length, [tickets]);
  const ticketApprovalCount = useMemo(() => tickets.filter((ticket) => ticket.status === "needs_approval").length, [tickets]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <Boxes size={22} />
          <div>
            <strong>AgentOps</strong>
            <span>Platform</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegacao principal">
          {views.map((view) => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                className={activeView === view.id ? "nav-item active" : "nav-item"}
                onClick={() => setActiveView(view.id)}
                type="button"
                title={view.label}
              >
                <Icon size={18} />
                <span>{view.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="runtime-card">
          <span className="eyebrow">Runtime</span>
          <strong>{mastra ? "Mastra registry" : "Aguardando API"}</strong>
          <small>{mastra?.registeredAgents.length ?? 0} agentes registrados</small>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Corporate AI Operations</span>
            <h1>{titleFor(activeView)}</h1>
          </div>
          <button className="icon-button" onClick={() => void refresh()} type="button" title="Atualizar">
            <RefreshCcw size={18} />
          </button>
        </header>

        {error ? <div className="notice error">{error}</div> : null}
        {loading ? <div className="notice">Sincronizando com o backend...</div> : null}

        {activeView === "command" ? (
          <CommandCenter
            metrics={metrics}
            criticalTickets={criticalTickets}
            ticketApprovalCount={ticketApprovalCount}
            runs={runs}
          />
        ) : null}
        {activeView === "knowledge" ? <KnowledgeBase documents={documents} onChanged={refresh} /> : null}
        {activeView === "tickets" ? <TicketsPanel tickets={tickets} onChanged={refresh} /> : null}
        {activeView === "agents" ? (
          <AgentsPanel agents={agents} runs={runs} evaluations={evaluations} onRun={refresh} />
        ) : null}
        {activeView === "approvals" ? <ApprovalsPanel approvals={approvals} onChanged={refresh} /> : null}
        {activeView === "audit" ? (
          <AuditPanel
            auditEvents={auditEvents}
            policies={policies}
            evaluations={evaluations}
            outboxMessages={outboxMessages}
            onChanged={refresh}
          />
        ) : null}
        {activeView === "azure" ? <AzurePanel mastra={mastra} metrics={metrics} /> : null}
      </main>
    </div>
  );
}

function CommandCenter({
  metrics,
  criticalTickets,
  ticketApprovalCount,
  runs
}: {
  metrics: PlatformMetrics;
  criticalTickets: number;
  ticketApprovalCount: number;
  runs: AgentRun[];
}) {
  return (
    <section className="view-grid">
      <div className="metric-grid">
        <Metric icon={Database} label="Documentos" value={metrics.documents} tone="green" />
        <Metric icon={ClipboardList} label="Tickets" value={metrics.tickets} tone="orange" />
        <Metric icon={Bot} label="Qualidade" value={metrics.averageQualityScore} suffix="%" tone="blue" />
        <Metric
          icon={Siren}
          label="Pendencias"
          value={criticalTickets + ticketApprovalCount + metrics.pendingApprovals + metrics.outboxPending + metrics.outboxFailed}
          tone="red"
        />
      </div>

      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Orquestracao</span>
            <h2>Execucoes recentes</h2>
          </div>
          <span className="pill">{metrics.averageLatencyMs} ms media</span>
        </div>
        <div className="run-list">
          {runs.slice(0, 5).map((run) => (
            <article className="run-row" key={run.id}>
              <div>
                <strong>{run.agentId}</strong>
                <p>{run.prompt}</p>
              </div>
              <span>{run.model}</span>
            </article>
          ))}
          {runs.length === 0 ? <EmptyState text="Nenhuma execucao registrada." /> : null}
        </div>
      </div>
    </section>
  );
}

function KnowledgeBase({ documents, onChanged }: { documents: DocumentRecord[]; onChanged: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("atendimento, ia");
  const [classification, setClassification] = useState<DocumentRecord["classification"]>("internal");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.createDocument({
        title,
        content,
        classification,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      });
      setTitle("");
      setContent("");
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function submitFile() {
    if (!file) {
      return;
    }

    setSaving(true);
    try {
      await api.uploadDocument(file, {
        title: title || undefined,
        classification,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      });
      setTitle("");
      setFile(null);
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="split-layout">
      <form className="panel" onSubmit={(event) => void submit(event)}>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">RAG</span>
            <h2>Novo documento</h2>
          </div>
          <FileText size={20} />
        </div>
        <label>
          Titulo
          <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} required />
        </label>
        <label>
          Tags
          <input value={tags} onChange={(event) => setTags(event.target.value)} />
        </label>
        <label>
          Classificacao
          <select value={classification} onChange={(event) => setClassification(event.target.value as DocumentRecord["classification"])}>
            <option value="public">public</option>
            <option value="internal">internal</option>
            <option value="confidential">confidential</option>
            <option value="restricted">restricted</option>
          </select>
        </label>
        <label>
          Conteudo
          <textarea value={content} onChange={(event) => setContent(event.target.value)} minLength={20} required />
        </label>
        <button className="primary-button" type="submit" disabled={saving}>
          <CheckCircle2 size={18} />
          Salvar
        </button>
        <div className="form-divider" />
        <label>
          Arquivo .txt/.md
          <input
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button className="secondary-button" type="button" disabled={saving || !file} onClick={() => void submitFile()}>
          <FileText size={18} />
          Upload
        </button>
      </form>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Base vetorial</span>
            <h2>Documentos</h2>
          </div>
          <span className="pill">{documents.length}</span>
        </div>
        <div className="document-list">
          {documents.map((document) => (
            <article className="document-row" key={document.id}>
              <strong>{document.title}</strong>
              <p>{document.content}</p>
              <div className="tag-row">
                <span>{document.classification}</span>
                <span>{document.chunks.length} chunks</span>
                {document.rawStorage ? <span>{document.rawStorage.provider}</span> : null}
              </div>
            </article>
          ))}
          {documents.length === 0 ? <EmptyState text="Nenhum documento cadastrado." /> : null}
        </div>
      </div>
    </section>
  );
}

function TicketsPanel({ tickets, onChanged }: { tickets: Ticket[]; onChanged: () => Promise<void> }) {
  const [subject, setSubject] = useState("");
  const [customer, setCustomer] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.createTicket({ subject, customer, description });
      setSubject("");
      setCustomer("");
      setDescription("");
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="split-layout">
      <form className="panel" onSubmit={(event) => void submit(event)}>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Workflow</span>
            <h2>Novo ticket</h2>
          </div>
          <Workflow size={20} />
        </div>
        <label>
          Assunto
          <input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} required />
        </label>
        <label>
          Cliente
          <input value={customer} onChange={(event) => setCustomer(event.target.value)} minLength={2} required />
        </label>
        <label>
          Descricao
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} required />
        </label>
        <button className="primary-button" type="submit" disabled={saving}>
          <Play size={18} />
          Triar
        </button>
      </form>

      <div className="ticket-board">
        {tickets.map((ticket) => (
          <article className={`ticket-card severity-${ticket.severity}`} key={ticket.id}>
            <div className="ticket-topline">
              <strong>{ticket.subject}</strong>
              <span>{ticket.severity}</span>
            </div>
            <p>{ticket.description}</p>
            <div className="tag-row">
              <span>{ticket.customer}</span>
              <span>{ticket.assignedAgent}</span>
              <span>{ticket.status}</span>
            </div>
          </article>
        ))}
        {tickets.length === 0 ? <EmptyState text="Nenhum ticket registrado." /> : null}
      </div>
    </section>
  );
}

function AgentsPanel({
  agents,
  runs,
  evaluations,
  onRun
}: {
  agents: AgentDefinition[];
  runs: AgentRun[];
  evaluations: AgentEvaluation[];
  onRun: () => Promise<void>;
}) {
  const [agentId, setAgentId] = useState<AgentId>("supervisor");
  const [prompt, setPrompt] = useState("Como devo responder um incidente critico de indisponibilidade?");
  const [running, setRunning] = useState(false);
  const [latestRun, setLatestRun] = useState<AgentRun | null>(runs[0] ?? null);
  const latestEvaluation = latestRun ? evaluations.find((evaluation) => evaluation.runId === latestRun.id) : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setRunning(true);
    try {
      const response = await api.runAgent(agentId, prompt);
      setLatestRun(response.data);
      await onRun();
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="split-layout agents-layout">
      <div className="agent-catalog">
        {agents.map((agent) => (
          <button
            className={agentId === agent.id ? "agent-tile active" : "agent-tile"}
            key={agent.id}
            onClick={() => setAgentId(agent.id)}
            type="button"
          >
            <strong>{agent.name}</strong>
            <span>{agent.role}</span>
          </button>
        ))}
      </div>

      <form className="panel console-panel" onSubmit={(event) => void submit(event)}>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Gateway LLM</span>
            <h2>Console agêntico</h2>
          </div>
          <Bot size={20} />
        </div>
        <label>
          Agente
          <select value={agentId} onChange={(event) => setAgentId(event.target.value as AgentId)}>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prompt
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} minLength={3} required />
        </label>
        <button className="primary-button" type="submit" disabled={running}>
          <Play size={18} />
          Executar
        </button>

        {latestRun ? (
          <div className="answer-box">
            <div className="tag-row">
              <span>{latestRun.model}</span>
              <span>{latestRun.latencyMs} ms</span>
              <span>{latestRun.retrievedContext.length} contextos</span>
              {latestEvaluation ? <span>{latestEvaluation.overallScore}% qualidade</span> : null}
            </div>
            <pre>{latestRun.answer}</pre>
            {latestEvaluation ? (
              <div className="score-strip">
                <span>RAG {latestEvaluation.retrievalScore}%</span>
                <span>Grounding {latestEvaluation.groundednessScore}%</span>
                <span>Safety {latestEvaluation.safetyScore}%</span>
              </div>
            ) : null}
            {latestRun.safetyFlags.length > 0 ? (
              <div className="flag-list">
                {latestRun.safetyFlags.map((flag) => (
                  <span key={flag.code}>{flag.code}</span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    </section>
  );
}

function ApprovalsPanel({ approvals, onChanged }: { approvals: ApprovalRequest[]; onChanged: () => Promise<void> }) {
  const [busyId, setBusyId] = useState("");

  async function decide(approval: ApprovalRequest, decision: "approved" | "rejected") {
    setBusyId(approval.id);
    try {
      await api.decideApproval(approval.id, {
        decision,
        actor: "local-reviewer",
        reason:
          decision === "approved"
            ? "Resposta liberada apos revisao humana."
            : "Resposta rejeitada por risco ou falta de contexto suficiente."
      });
      await onChanged();
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="view-grid">
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Human-in-the-loop</span>
            <h2>Fila de aprovacoes</h2>
          </div>
          <span className="pill">{approvals.filter((approval) => approval.status === "pending").length} pendentes</span>
        </div>

        <div className="approval-list">
          {approvals.map((approval) => (
            <article className={`approval-card status-${approval.status}`} key={approval.id}>
              <div className="approval-heading">
                <div>
                  <strong>{approval.agentId}</strong>
                  <p>{approval.prompt}</p>
                </div>
                <span>{approval.status}</span>
              </div>
              <pre>{approval.answerPreview}</pre>
              <div className="flag-list">
                {approval.safetyFlags.map((flag) => (
                  <span key={flag.code}>{flag.code}</span>
                ))}
              </div>
              {approval.status === "pending" ? (
                <div className="approval-actions">
                  <button
                    className="approve-button"
                    type="button"
                    disabled={busyId === approval.id}
                    onClick={() => void decide(approval, "approved")}
                  >
                    <CheckCircle2 size={18} />
                    Aprovar
                  </button>
                  <button
                    className="reject-button"
                    type="button"
                    disabled={busyId === approval.id}
                    onClick={() => void decide(approval, "rejected")}
                  >
                    <XCircle size={18} />
                    Rejeitar
                  </button>
                </div>
              ) : (
                <div className="decision-note">
                  <strong>{approval.decidedBy}</strong>
                  <span>{approval.decisionReason}</span>
                </div>
              )}
            </article>
          ))}
          {approvals.length === 0 ? <EmptyState text="Nenhuma aprovacao foi solicitada." /> : null}
        </div>
      </div>
    </section>
  );
}

function AuditPanel({
  auditEvents,
  policies,
  evaluations,
  outboxMessages,
  onChanged
}: {
  auditEvents: AuditEvent[];
  policies: GovernancePolicy[];
  evaluations: AgentEvaluation[];
  outboxMessages: OutboxMessage[];
  onChanged: () => Promise<void>;
}) {
  const [dispatching, setDispatching] = useState(false);
  const pendingOutbox = outboxMessages.filter((message) => message.status === "pending").length;

  async function dispatchOutbox() {
    setDispatching(true);
    try {
      await api.dispatchOutbox();
      await onChanged();
    } finally {
      setDispatching(false);
    }
  }

  return (
    <section className="split-layout">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Governanca</span>
            <h2>Politicas</h2>
          </div>
          <ShieldCheck size={20} />
        </div>
        <div className="policy-list">
          {policies.map((policy) => (
            <article className="policy-row" key={policy.id}>
              <strong>{policy.name}</strong>
              <p>{policy.description}</p>
            </article>
          ))}
        </div>

        <div className="evaluation-stack">
          <span className="eyebrow">Evals</span>
          {evaluations.slice(0, 4).map((evaluation) => (
            <article className="evaluation-row" key={evaluation.id}>
              <strong>{evaluation.overallScore}%</strong>
              <div>
                <span>run {evaluation.runId.slice(0, 8)}</span>
                <p>{evaluation.findings[0] ?? "Sem achados."}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="outbox-stack">
          <div className="panel-heading compact-heading">
            <div>
              <span className="eyebrow">Outbox</span>
              <h2>Entrega assincrona</h2>
            </div>
            <button
              className="secondary-button"
              type="button"
              disabled={dispatching || pendingOutbox === 0}
              onClick={() => void dispatchOutbox()}
            >
              <Play size={16} />
              Despachar
            </button>
          </div>
          <div className="outbox-list">
            {outboxMessages.slice(0, 6).map((message) => (
              <article className={`outbox-row outbox-${message.status}`} key={message.id}>
                <div>
                  <strong>{message.type}</strong>
                  <span>{message.status}</span>
                </div>
                <small>{message.attempts} tentativa(s)</small>
              </article>
            ))}
            {outboxMessages.length === 0 ? <EmptyState text="Nenhuma mensagem na outbox." /> : null}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Trilha</span>
            <h2>Eventos</h2>
          </div>
          <span className="pill">{auditEvents.length}</span>
        </div>
        <div className="audit-list">
          {auditEvents.map((event) => (
            <article className="audit-row" key={event.id}>
              <div>
                <strong>{event.type}</strong>
                <span>{event.actor}</span>
              </div>
              <time>{formatDate(event.createdAt)}</time>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AzurePanel({
  mastra,
  metrics
}: {
  mastra: { registeredAgents: string[]; model: string } | null;
  metrics: PlatformMetrics;
}) {
  const steps = [
    "Azure OpenAI conectado via LiteLLM",
    "Qdrant local ou cloud para busca vetorial",
    "Service Bus para eventos de workflow",
    "Blob Storage para documentos brutos",
    "Key Vault para segredos",
    "Container Apps ou AKS para deploy",
    "Azure Monitor para traces e logs"
  ];

  return (
    <section className="view-grid">
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Cloud target</span>
            <h2>Mapa Azure</h2>
          </div>
          <Cloud size={20} />
        </div>
        <div className="azure-map">
          {steps.map((step, index) => (
            <div className="azure-node" key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="metric-grid">
        <Metric icon={Bot} label="Mastra agents" value={mastra?.registeredAgents.length ?? 0} tone="blue" />
        <Metric icon={Database} label="RAG docs" value={metrics.documents} tone="green" />
        <Metric icon={ShieldCheck} label="Audit events" value={metrics.auditEvents} tone="orange" />
        <Metric icon={Workflow} label="Agent runs" value={metrics.agentRuns} tone="red" />
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  suffix = "",
  tone
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  suffix?: string;
  tone: "green" | "orange" | "blue" | "red";
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <Icon size={20} />
      <span>{label}</span>
      <strong>
        {value}
        {suffix}
      </strong>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function titleFor(view: View) {
  const titles: Record<View, string> = {
    command: "Centro de operacao",
    knowledge: "Base RAG",
    tickets: "Triagem de tickets",
    agents: "Orquestracao de agentes",
    approvals: "Aprovacoes humanas",
    audit: "Governanca e auditoria",
    azure: "Arquitetura Azure"
  };
  return titles[view];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}
