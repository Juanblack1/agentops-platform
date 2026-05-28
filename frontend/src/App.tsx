import {
  Activity,
  AlertCircle,
  Bot,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Cloud,
  Cpu,
  Database,
  FileUp,
  FileText,
  Gauge,
  KeyRound,
  Play,
  RadioTower,
  RefreshCcw,
  Server,
  ShieldCheck,
  Siren,
  Workflow,
  XCircle
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError, api } from "./api";
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
  tracedRuns: 0,
  totalTokens: 0,
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
  { id: "command", label: "Dashboard", icon: Activity },
  { id: "knowledge", label: "Knowledge", icon: Database },
  { id: "tickets", label: "Tickets", icon: ClipboardList },
  { id: "agents", label: "Agentes", icon: Bot },
  { id: "approvals", label: "Aprovacoes", icon: ShieldCheck },
  { id: "audit", label: "Auditoria", icon: ShieldCheck },
  { id: "azure", label: "Runtime", icon: Cloud }
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
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [mastra, setMastra] = useState<{
    registeredAgents: string[];
    registeredTools: string[];
    registeredWorkflows: string[];
    model: string;
    mode: string;
    studio: {
      apiCommand: string;
      studioCommand: string;
      apiUrl: string;
      studioUrl: string;
    };
  } | null>(null);
  const [apiKey, setApiKey] = useState(() => api.getApiKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    setAuthNotice("");
    try {
      const [systemResponse, agentsResponse, mastraResponse, policiesResponse] = await Promise.all([
        api.system(),
        api.agents(),
        api.mastra(),
        api.policies()
      ]);

      setPolicies(policiesResponse.data);
      setSystem(systemResponse.data);
      setAgents(agentsResponse.data);
      setMastra(mastraResponse.data);

      if (systemResponse.data.authRequired && !api.getApiKey()) {
        resetOperationalState();
        setAuthNotice("API key exigida para dados operacionais.");
        return;
      }

      const [
        metricsResponse,
        documentsResponse,
        ticketsResponse,
        runsResponse,
        evaluationsResponse,
        approvalsResponse,
        auditResponse,
        outboxResponse
      ] = await Promise.all([
        api.metrics(),
        api.documents(),
        api.tickets(),
        api.agentRuns(),
        api.evaluations(),
        api.approvals(),
        api.auditEvents(),
        api.outbox()
      ]);

      setMetrics(metricsResponse.data);
      setDocuments(documentsResponse.data);
      setTickets(ticketsResponse.data);
      setRuns(runsResponse.data);
      setEvaluations(evaluationsResponse.data);
      setApprovals(approvalsResponse.data);
      setAuditEvents(auditResponse.data);
      setOutboxMessages(outboxResponse.data);
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
        resetOperationalState();
        setAuthNotice(cause.status === 401 ? "API key ausente ou invalida." : "A API key atual nao tem permissao para esta operacao.");
        return;
      }

      setError(cause instanceof Error ? cause.message : "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  function resetOperationalState() {
    setMetrics(emptyMetrics);
    setDocuments([]);
    setTickets([]);
    setRuns([]);
    setEvaluations([]);
    setApprovals([]);
    setAuditEvents([]);
    setOutboxMessages([]);
  }

  useEffect(() => {
    void refresh();
  }, []);

  function saveApiKey() {
    api.setApiKey(apiKey);
    setStatusMessage(apiKey.trim() ? "API key ativa nesta sessao." : "API key removida.");
    void refresh();
  }

  function clearApiKey() {
    setApiKey("");
    api.setApiKey("");
    setStatusMessage("API key removida.");
    void refresh();
  }

  async function seedDemo() {
    setLoading(true);
    setError("");
    setStatusMessage("");
    try {
      await api.seedDemo();
      setStatusMessage("Dados de demonstracao carregados.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar demonstracao.");
    } finally {
      setLoading(false);
    }
  }

  const criticalTickets = useMemo(() => tickets.filter((ticket) => ticket.severity === "critical").length, [tickets]);
  const ticketApprovalCount = useMemo(() => tickets.filter((ticket) => ticket.status === "needs_approval").length, [tickets]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Ir para o conteudo
      </a>
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
                aria-current={activeView === view.id ? "page" : undefined}
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

      <main className="workspace" id="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Operacao de IA corporativa</span>
            <h1>{titleFor(activeView)}</h1>
            <p className="page-summary">{summaryFor(activeView)}</p>
          </div>
          <div className="topbar-actions">
            <div className="connection-chip" title="Backend e provider ativo">
              <RadioTower size={16} />
          <span>{system ? `${system.llmProvider} / ${system.vectorStore}` : "Conectando"}</span>
            </div>
            <label className="api-key-control">
              <KeyRound size={16} />
              <input
                name="api-key"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="x-api-key"
                type="password"
                autoComplete="off"
                aria-label="API key"
                spellCheck={false}
              />
            </label>
            <button className="icon-button" onClick={saveApiKey} type="button" title="Salvar API key" aria-label="Salvar API key">
              <CheckCircle2 size={18} />
            </button>
            <button className="icon-button" onClick={clearApiKey} type="button" title="Limpar API key" aria-label="Limpar API key">
              <XCircle size={18} />
            </button>
            <button className="secondary-button" onClick={() => void seedDemo()} type="button" disabled={loading || Boolean(system?.authRequired && !apiKey.trim())}>
              <Database size={16} />
              Carregar demo
            </button>
            <button className="icon-button" onClick={() => void refresh()} type="button" title="Atualizar" aria-label="Atualizar">
              <RefreshCcw size={18} />
            </button>
          </div>
        </header>

        {error ? (
          <div className="notice error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button type="button" onClick={() => void refresh()}>
              Tentar novamente
            </button>
          </div>
        ) : null}
        {authNotice ? (
          <div className="notice warning" role="status">
            <KeyRound size={18} />
            <span>{authNotice}</span>
          </div>
        ) : null}
        {statusMessage ? (
          <div className="notice success" role="status">
            <CheckCircle2 size={18} />
            <span>{statusMessage}</span>
          </div>
        ) : null}
        {loading ? <LoadingState /> : null}

        {activeView === "command" ? (
          <CommandCenter
            metrics={metrics}
            criticalTickets={criticalTickets}
            ticketApprovalCount={ticketApprovalCount}
            runs={runs}
            mastra={mastra}
            system={system}
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
  runs,
  mastra,
  system
}: {
  metrics: PlatformMetrics;
  criticalTickets: number;
  ticketApprovalCount: number;
  runs: AgentRun[];
  mastra: {
    registeredAgents: string[];
    registeredTools: string[];
    registeredWorkflows: string[];
    model: string;
    mode: string;
    studio: {
      apiCommand: string;
      studioCommand: string;
      apiUrl: string;
      studioUrl: string;
    };
  } | null;
  system: SystemStatus | null;
}) {
  return (
    <section className="view-grid">
      <div className="metric-grid">
        <Metric icon={Database} label="Documentos" value={metrics.documents} tone="green" />
        <Metric icon={ClipboardList} label="Tickets" value={metrics.tickets} tone="orange" />
        <Metric icon={Bot} label="Execucoes" value={metrics.agentRuns} tone="blue" />
        <Metric icon={Gauge} label="Qualidade" value={metrics.averageQualityScore} suffix="%" tone="green" />
        <Metric icon={Cpu} label="Latencia" value={metrics.averageLatencyMs} suffix=" ms" tone="blue" />
        <Metric icon={Workflow} label="Traces" value={metrics.tracedRuns} tone="orange" />
        <Metric icon={Server} label="Outbox" value={metrics.outboxPending + metrics.outboxFailed} tone="red" />
        <Metric
          icon={Siren}
          label="Pendencias"
          value={criticalTickets + ticketApprovalCount + metrics.pendingApprovals + metrics.outboxPending + metrics.outboxFailed}
          tone="red"
        />
      </div>

      <div className="workspace-grid">
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Orquestracao</span>
            <h2>Execucoes recentes</h2>
          </div>
          <span className="pill">{metrics.averageLatencyMs} ms media</span>
        </div>
        <div className="run-list">
          {runs.slice(0, 6).map((run) => (
            <article className="run-row" key={run.id}>
              <div>
                <strong>{run.agentId}</strong>
                <p>{run.prompt}</p>
                <div className="tag-row">
                  <span>trace {run.traceId.slice(0, 8)}</span>
                  <span>{run.provider}</span>
                  {run.tokenUsage?.totalTokens ? <span>{run.tokenUsage.totalTokens} tokens</span> : null}
                </div>
              </div>
              <span>{run.model}</span>
            </article>
          ))}
          {runs.length === 0 ? (
            <EmptyState title="Nenhuma execucao" text="Execute um agente ou carregue dados de demonstracao para ver traces, contexto e avaliacao." />
          ) : null}
        </div>
      </div>

      <div className="panel runtime-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Runtime</span>
            <h2>Mastra e backend</h2>
          </div>
          <span className={system ? "status-dot ok" : "status-dot"} aria-label={system ? "Runtime disponivel" : "Runtime indisponivel"} />
        </div>
        <div className="runtime-grid">
          <RuntimeItem label="Provider" value={system?.llmProvider ?? "Aguardando"} />
          <RuntimeItem label="Modelo" value={system?.llmModel ?? mastra?.model ?? "Aguardando"} />
          <RuntimeItem label="Store" value={system?.dataStore ?? "Aguardando"} />
          <RuntimeItem label="Vector" value={system?.vectorStore ?? "Aguardando"} />
        </div>
        <div className="runtime-list">
          <span>{mastra?.registeredAgents.length ?? 0} agentes</span>
          <span>{mastra?.registeredTools.length ?? 0} tools</span>
          <span>{mastra?.registeredWorkflows.length ?? 0} workflow</span>
        </div>
        {mastra ? (
          <div className="command-block">
            <code>{mastra.studio.apiCommand}</code>
            <code>{mastra.studio.studioCommand}</code>
          </div>
        ) : null}
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
          <input name="document-title" value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} autoComplete="off" required />
        </label>
        <label>
          Tags
          <input name="document-tags" value={tags} onChange={(event) => setTags(event.target.value)} autoComplete="off" />
        </label>
        <label>
          Classificacao
          <select name="document-classification" value={classification} onChange={(event) => setClassification(event.target.value as DocumentRecord["classification"])}>
            <option value="public">public</option>
            <option value="internal">internal</option>
            <option value="confidential">confidential</option>
            <option value="restricted">restricted</option>
          </select>
        </label>
        <label>
          Conteudo
          <textarea name="document-content" value={content} onChange={(event) => setContent(event.target.value)} minLength={20} autoComplete="off" required />
        </label>
        <button className="primary-button" type="submit" disabled={saving}>
          <CheckCircle2 size={18} />
          Salvar documento
        </button>
        <div className="form-divider" />
        <label>
          Arquivo .txt/.md
          <input
            name="document-file"
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button className="secondary-button" type="button" disabled={saving || !file} onClick={() => void submitFile()}>
          <FileUp size={18} />
          Enviar arquivo
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
          {documents.length === 0 ? (
            <EmptyState title="Nenhum documento" text="Adicione runbooks, politicas ou notas operacionais para alimentar o contexto RAG." />
          ) : null}
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
          <input name="ticket-subject" value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} autoComplete="off" required />
        </label>
        <label>
          Cliente
          <input name="ticket-customer" value={customer} onChange={(event) => setCustomer(event.target.value)} minLength={2} autoComplete="organization" required />
        </label>
        <label>
          Descricao
          <textarea name="ticket-description" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} autoComplete="off" required />
        </label>
        <button className="primary-button" type="submit" disabled={saving}>
          <Play size={18} />
          Triar ticket
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
        {tickets.length === 0 ? (
          <EmptyState title="Nenhum ticket" text="Crie um ticket para validar classificacao, roteamento e trilha de auditoria." />
        ) : null}
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

  useEffect(() => {
    if (!latestRun && runs[0]) {
      setLatestRun(runs[0]);
    }
  }, [latestRun, runs]);

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
            <h2>Console agentico</h2>
          </div>
          <Bot size={20} />
        </div>
        <label>
          Agente
          <select name="agent-id" value={agentId} onChange={(event) => setAgentId(event.target.value as AgentId)}>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prompt
          <textarea name="agent-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} minLength={3} autoComplete="off" required />
        </label>
        <button className="primary-button" type="submit" disabled={running}>
          <Play size={18} />
          Executar agente
        </button>

        {latestRun ? (
          <div className="answer-box">
            <div className="tag-row">
              <span>trace {latestRun.traceId.slice(0, 8)}</span>
              <span>{latestRun.provider}</span>
              <span>{latestRun.model}</span>
              <span>{latestRun.latencyMs} ms</span>
              <span>{latestRun.retrievedContext.length} contextos</span>
              {latestRun.tokenUsage?.totalTokens ? <span>{latestRun.tokenUsage.totalTokens} tokens</span> : null}
              {latestEvaluation ? <span>{latestEvaluation.overallScore}% qualidade</span> : null}
            </div>
            <pre>{latestRun.answer}</pre>
            <div className="trace-stack">
              {latestRun.trace.spans.map((span) => (
                <span key={`${latestRun.id}-${span.name}`}>
                  {span.name} {span.durationMs} ms
                </span>
              ))}
            </div>
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
                    Aprovar resposta
                  </button>
                  <button
                    className="reject-button"
                    type="button"
                    disabled={busyId === approval.id}
                    onClick={() => void decide(approval, "rejected")}
                  >
                    <XCircle size={18} />
                    Rejeitar resposta
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
          {approvals.length === 0 ? (
            <EmptyState title="Fila limpa" text="Execucoes com risco alto ou dados sensiveis aparecem aqui para revisao humana." />
          ) : null}
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
              Despachar eventos
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
            {outboxMessages.length === 0 ? <EmptyState title="Outbox vazia" text="Eventos de auditoria e integracao pendentes aparecem nesta fila." /> : null}
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
                <span>
                  {event.actor}
                  {typeof event.metadata.traceId === "string" ? ` - trace ${event.metadata.traceId.slice(0, 8)}` : ""}
                </span>
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
  mastra: {
    registeredAgents: string[];
    registeredTools: string[];
    registeredWorkflows: string[];
    model: string;
    mode: string;
    studio: {
      apiCommand: string;
      studioCommand: string;
      apiUrl: string;
      studioUrl: string;
    };
  } | null;
  metrics: PlatformMetrics;
}) {
  const steps = [
    "Vercel entrega a UI e proxy serverless",
    "Gemini via Vercel AI SDK como LLM real opcional",
    "PostgreSQL + pgvector para memoria RAG no Azure",
    "Blob Storage para documentos brutos",
    "Service Bus para outbox e workflows assincronos",
    "Mastra Studio para agentes, tools e workflow",
    "Budget Azure com alertas de custo"
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
        <Metric icon={Workflow} label="Tools" value={mastra?.registeredTools.length ?? 0} tone="green" />
        <Metric icon={ShieldCheck} label="Traces" value={metrics.tracedRuns} tone="orange" />
        <Metric icon={Database} label="Tokens" value={metrics.totalTokens} tone="red" />
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

function RuntimeItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="runtime-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ title = "Sem dados", text }: { title?: string; text: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="loading-state" role="status" aria-label="Carregando dados" aria-live="polite">
      <span />
      <span />
      <span />
    </div>
  );
}

function titleFor(view: View) {
  const titles: Record<View, string> = {
    command: "Centro de operacao",
    knowledge: "Base RAG",
    tickets: "Triagem de tickets",
    agents: "Orquestracao de agentes",
    approvals: "Aprovacoes humanas",
    audit: "Governanca e auditoria",
    azure: "Runtime e deploy"
  };
  return titles[view];
}

function summaryFor(view: View) {
  const summaries: Record<View, string> = {
    command: "Visao executiva de agentes, traces, qualidade, latencia e pendencias operacionais.",
    knowledge: "Ingestao de documentos, classificacao e preparo do contexto usado pelo RAG.",
    tickets: "Criacao e roteamento de tickets para agentes com triagem automatizada.",
    agents: "Console para executar agentes, revisar contexto recuperado e acompanhar avaliacao.",
    approvals: "Fila human-in-the-loop para respostas que exigem revisao.",
    audit: "Politicas, eventos, avaliacoes e outbox para governanca operacional.",
    azure: "Resumo de runtime, Mastra Studio, deploy e componentes de producao."
  };
  return summaries[view];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}
