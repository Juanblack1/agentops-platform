import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  BookOpenCheck,
  Boxes,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Database,
  FileCheck2,
  FileUp,
  FileText,
  KeyRound,
  LockKeyhole,
  MessageSquareText,
  Play,
  RadioTower,
  RefreshCcw,
  Route,
  SearchCheck,
  Send,
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

type View = "command" | "knowledge" | "tickets" | "agents" | "approvals" | "audit";

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
  { id: "command", label: "Visao geral", icon: Activity },
  { id: "knowledge", label: "Conhecimento", icon: Database },
  { id: "tickets", label: "Pedidos", icon: ClipboardList },
  { id: "agents", label: "Responder", icon: Bot },
  { id: "approvals", label: "Revisar", icon: ShieldCheck },
  { id: "audit", label: "Auditar", icon: SearchCheck }
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
      const [systemResponse, agentsResponse, policiesResponse] = await Promise.all([
        api.system(),
        api.agents(),
        api.policies()
      ]);

      setPolicies(policiesResponse.data);
      setSystem(systemResponse.data);
      setAgents(agentsResponse.data);

      if (systemResponse.data.authRequired && !api.getApiKey()) {
        resetOperationalState();
        setAuthNotice("Cole uma chave de acesso operacional para ver dados, cadastrar conhecimento e executar agentes.");
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
        setAuthNotice(cause.status === 401 ? "A chave de acesso esta ausente ou invalida." : "A chave de acesso atual nao permite esta operacao.");
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
    setStatusMessage(apiKey.trim() ? "Chave de acesso ativa nesta sessao." : "Chave de acesso removida.");
    void refresh();
  }

  function clearApiKey() {
    setApiKey("");
    api.setApiKey("");
    setStatusMessage("Chave de acesso removida.");
    void refresh();
  }

  const criticalTickets = useMemo(() => tickets.filter((ticket) => ticket.severity === "critical").length, [tickets]);
  const ticketApprovalCount = useMemo(() => tickets.filter((ticket) => ticket.status === "needs_approval").length, [tickets]);
  const hasOperationalData = metrics.documents + metrics.tickets + metrics.agentRuns + metrics.auditEvents > 0;
  const authRequiredWithoutKey = Boolean(system?.authRequired && !apiKey.trim());

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
          <span className="eyebrow">Status</span>
          <strong>{agents.length > 0 ? "Agentes prontos" : "Aguardando API"}</strong>
          <small>{agents.length} agentes disponiveis</small>
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
            <div className="connection-chip" title="Status da API">
              <RadioTower size={16} />
              <span>{system ? "API conectada" : "Conectando"}</span>
            </div>
            <label className="api-key-control">
              <KeyRound size={16} />
              <input
                name="api-key"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="chave de acesso"
                type="password"
                autoComplete="off"
                aria-label="Chave de acesso"
                spellCheck={false}
              />
            </label>
            <button className="secondary-button compact-action" onClick={saveApiKey} type="button" title="Usar chave de acesso">
              <CheckCircle2 size={18} />
              Usar chave
            </button>
            <button className="icon-button" onClick={clearApiKey} type="button" title="Limpar chave de acesso" aria-label="Limpar chave de acesso">
              <XCircle size={18} />
            </button>
            <button className="icon-button" onClick={() => void refresh()} type="button" title="Atualizar dados" aria-label="Atualizar dados">
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
            hasOperationalData={hasOperationalData}
            authRequiredWithoutKey={authRequiredWithoutKey}
            loading={loading}
            onNavigate={setActiveView}
          />
        ) : null}
        {activeView === "knowledge" ? <KnowledgeBase documents={documents} authRequiredWithoutKey={authRequiredWithoutKey} onChanged={refresh} /> : null}
        {activeView === "tickets" ? <TicketsPanel tickets={tickets} authRequiredWithoutKey={authRequiredWithoutKey} onChanged={refresh} /> : null}
        {activeView === "agents" ? (
          <AgentsPanel agents={agents} runs={runs} evaluations={evaluations} authRequiredWithoutKey={authRequiredWithoutKey} onRun={refresh} />
        ) : null}
        {activeView === "approvals" ? <ApprovalsPanel approvals={approvals} authRequiredWithoutKey={authRequiredWithoutKey} onChanged={refresh} /> : null}
        {activeView === "audit" ? (
          <AuditPanel
            auditEvents={auditEvents}
            policies={policies}
            evaluations={evaluations}
            outboxMessages={outboxMessages}
            authRequiredWithoutKey={authRequiredWithoutKey}
            onChanged={refresh}
          />
        ) : null}
      </main>
    </div>
  );
}

function CommandCenter({
  metrics,
  criticalTickets,
  ticketApprovalCount,
  runs,
  hasOperationalData,
  authRequiredWithoutKey,
  loading,
  onNavigate
}: {
  metrics: PlatformMetrics;
  criticalTickets: number;
  ticketApprovalCount: number;
  runs: AgentRun[];
  hasOperationalData: boolean;
  authRequiredWithoutKey: boolean;
  loading: boolean;
  onNavigate: (view: View) => void;
}) {
  const nextStep = getCommandNextStep(metrics, authRequiredWithoutKey);
  const journeySteps = [
    {
      number: "1",
      icon: BookOpenCheck,
      title: "Ensine o contexto",
      text: "Coloque regras, runbooks e politicas que os agentes podem consultar.",
      action: "Abrir conhecimento",
      done: metrics.documents > 0,
      active: !authRequiredWithoutKey && metrics.documents === 0,
      status: metrics.documents > 0 ? `${metrics.documents} documento(s)` : "Primeiro passo",
      onClick: () => onNavigate("knowledge")
    },
    {
      number: "2",
      icon: ClipboardList,
      title: "Registre o pedido",
      text: "Descreva o problema do cliente ou da area afetada em linguagem simples.",
      action: "Abrir pedidos",
      done: metrics.tickets > 0,
      active: !authRequiredWithoutKey && metrics.documents > 0 && metrics.tickets === 0,
      status: metrics.tickets > 0 ? `${metrics.tickets} pedido(s)` : "Depois do contexto",
      onClick: () => onNavigate("tickets")
    },
    {
      number: "3",
      icon: MessageSquareText,
      title: "Peça uma resposta",
      text: "Escolha o papel do agente e veja resposta, fontes consultadas e avaliacao.",
      action: "Abrir agentes",
      done: metrics.agentRuns > 0,
      active: !authRequiredWithoutKey && metrics.documents > 0 && metrics.tickets > 0 && metrics.agentRuns === 0,
      status: metrics.agentRuns > 0 ? `${metrics.agentRuns} resposta(s)` : "Depois do pedido",
      onClick: () => onNavigate("agents")
    },
    {
      number: "4",
      icon: FileCheck2,
      title: "Aprove e prove",
      text: "Libere respostas sensiveis e confira o historico de decisoes.",
      action: metrics.pendingApprovals > 0 ? "Abrir revisoes" : "Ver auditoria",
      done: metrics.evaluations > 0 || metrics.auditEvents > 0,
      active: !authRequiredWithoutKey && metrics.pendingApprovals > 0,
      status: metrics.pendingApprovals > 0 ? `${metrics.pendingApprovals} pendente(s)` : metrics.auditEvents > 0 ? "Auditado" : "Ultima etapa",
      onClick: () => onNavigate(metrics.pendingApprovals > 0 ? "approvals" : "audit")
    }
  ];
  const taskCards = [
    {
      icon: Database,
      title: "Adicionar base da empresa",
      text: "Cole uma politica ou envie um arquivo para orientar as respostas.",
      meta: `${metrics.documents} documento(s)`,
      target: "knowledge" as const
    },
    {
      icon: ClipboardList,
      title: "Abrir pedido para triagem",
      text: "Registre um problema real e deixe a plataforma classificar prioridade.",
      meta: `${metrics.tickets} pedido(s)`,
      target: "tickets" as const
    },
    {
      icon: Bot,
      title: "Gerar resposta auditavel",
      text: "Escolha um agente e veja o que ele usou para responder.",
      meta: `${metrics.agentRuns} resposta(s)`,
      target: "agents" as const
    },
    {
      icon: ShieldCheck,
      title: "Revisar risco",
      text: "Aprove ou rejeite respostas que acionaram politica de seguranca.",
      meta: `${metrics.pendingApprovals} pendente(s)`,
      target: "approvals" as const
    }
  ];

  function runNextStep() {
    onNavigate(nextStep.target);
  }

  return (
    <section className="overview-grid">
      <div className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Para que serve</span>
          <h2>Transforme documentos e pedidos em respostas de IA que podem ser revisadas e auditadas.</h2>
          <p>
            Use este painel quando precisar responder clientes ou incidentes com base no conhecimento da empresa, mantendo
            aprovacao humana e historico do que foi feito.
          </p>
          <div className="intro-actions">
            <button className="primary-button" type="button" disabled={loading} onClick={runNextStep}>
              <ArrowRight size={18} />
              {nextStep.action}
            </button>
            <button className="secondary-button" type="button" onClick={() => onNavigate("agents")}>
              <Bot size={18} />
              Ver agentes
            </button>
          </div>
        </div>

        <div className="outcome-list" aria-label="Resultado esperado">
          <div>
            <CircleDot size={16} />
            <span>O agente responde usando documentos cadastrados.</span>
          </div>
          <div>
            <CircleDot size={16} />
            <span>Respostas sensiveis ficam presas para revisao.</span>
          </div>
          <div>
            <CircleDot size={16} />
            <span>A auditoria mostra contexto, qualidade e eventos.</span>
          </div>
        </div>
      </div>

      {authRequiredWithoutKey ? <AccessCallout /> : null}

      <div className="next-step-panel">
        <div>
          <span className="eyebrow">Proximo passo</span>
          <strong>{nextStep.title}</strong>
          <p>{nextStep.text}</p>
        </div>
        <button className="primary-button" type="button" disabled={loading} onClick={runNextStep}>
          <Play size={18} />
          {nextStep.action}
        </button>
      </div>

      <div className="journey-grid" aria-label="Fluxo recomendado">
        {journeySteps.map((step) => (
          <JourneyStep key={step.number} {...step} />
        ))}
      </div>

      <div className="task-grid" aria-label="Tarefas principais">
        {taskCards.map((task) => (
          <TaskCard key={task.title} {...task} onNavigate={onNavigate} locked={authRequiredWithoutKey} />
        ))}
      </div>

      <div className="metric-grid compact-metrics">
        <Metric icon={Database} label="Documentos" value={metrics.documents} tone="green" />
        <Metric icon={ClipboardList} label="Pedidos" value={metrics.tickets} tone="orange" />
        <Metric icon={Bot} label="Respostas" value={metrics.agentRuns} tone="blue" />
        <Metric icon={Siren} label="Pendencias" value={criticalTickets + ticketApprovalCount + metrics.pendingApprovals + metrics.outboxPending + metrics.outboxFailed} tone="red" />
      </div>

      <div className="workspace-grid">
        <div className="panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">O que aconteceu</span>
              <h2>Ultimas respostas dos agentes</h2>
            </div>
            <span className="pill">{metrics.averageLatencyMs} ms em media</span>
          </div>
          <div className="run-list">
            {runs.slice(0, 6).map((run) => (
              <article className="run-row" key={run.id}>
                <div>
                  <strong>{run.agentId}</strong>
                  <p>{run.prompt}</p>
                  <div className="tag-row">
                    <span>{run.retrievedContext.length} fonte(s)</span>
                    <span>{run.safetyFlags.length} alerta(s)</span>
                    {run.tokenUsage?.totalTokens ? <span>{run.tokenUsage.totalTokens} tokens</span> : null}
                  </div>
                </div>
                <span>{formatDate(run.createdAt)}</span>
              </article>
            ))}
            {runs.length === 0 ? (
              <EmptyState
                title={hasOperationalData ? "Nenhuma resposta gerada" : "Nenhum fluxo iniciado"}
                text={
                  hasOperationalData
                    ? "Abra Responder para pedir uma resposta com fontes, avaliacao e historico."
                    : "Comece adicionando conhecimento da empresa. Depois registre um pedido e acione um agente."
                }
              />
            ) : null}
          </div>
        </div>

        <div className="panel operations-help-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Como usar</span>
              <h2>Fluxo de operacao</h2>
            </div>
            <Route size={20} />
          </div>
          <div className="glossary-list">
            <GlossaryItem term="1. Conhecimento" text="Adicione regras e procedimentos aprovados pela empresa." />
            <GlossaryItem term="2. Pedido" text="Registre o problema que precisa de triagem ou resposta." />
            <GlossaryItem term="3. Resposta" text="Escolha o agente adequado e confira as fontes usadas." />
            <GlossaryItem term="4. Revisao" text="Aprove respostas sensiveis antes de liberar." />
          </div>
        </div>
      </div>
    </section>
  );
}

function AccessCallout() {
  return (
    <div className="access-callout" role="status">
      <LockKeyhole size={20} />
      <div>
        <strong>Chave de acesso necessaria para operar</strong>
        <p>Cole uma chave no topo para adicionar documentos, criar pedidos, executar agentes e aprovar respostas.</p>
      </div>
    </div>
  );
}

function JourneyStep({
  number,
  icon: Icon,
  title,
  text,
  action,
  done,
  active,
  status,
  onClick
}: {
  number: string;
  icon: typeof Activity;
  title: string;
  text: string;
  action: string;
  done: boolean;
  active: boolean;
  status: string;
  onClick: () => void;
}) {
  return (
    <article className={done ? "journey-card done" : active ? "journey-card active" : "journey-card"}>
      <div className="journey-number">{number}</div>
      <Icon size={20} />
      <strong>{title}</strong>
      <p>{text}</p>
      <span className={done ? "step-status done" : "step-status"}>{done ? "Concluido" : status}</span>
      <button className="secondary-button" type="button" onClick={onClick}>
        {action}
      </button>
    </article>
  );
}

function TaskCard({
  icon: Icon,
  title,
  text,
  meta,
  target,
  locked,
  onNavigate
}: {
  icon: typeof Activity;
  title: string;
  text: string;
  meta: string;
  target: View;
  locked: boolean;
  onNavigate: (view: View) => void;
}) {
  return (
    <button className={locked ? "task-card locked" : "task-card"} type="button" onClick={() => onNavigate(target)}>
      <Icon size={20} />
      <span className="task-meta">{locked ? "Requer chave" : meta}</span>
      <strong>{title}</strong>
      <p>{text}</p>
      <span className="task-link">
        Abrir
        <ArrowRight size={15} />
      </span>
    </button>
  );
}

function getCommandNextStep(metrics: PlatformMetrics, authRequiredWithoutKey: boolean) {
  if (authRequiredWithoutKey) {
    return {
      title: "Informe a chave operacional",
      text: "Sem chave, voce consegue ver o catalogo de agentes. Para salvar dados e executar IA, cole a chave no topo.",
      action: "Ver orientacao",
      target: "command" as const
    };
  }

  if (metrics.documents === 0) {
    return {
      title: "Adicione o primeiro conhecimento",
      text: "Os agentes precisam de regras, runbooks ou procedimentos reais para responder com base na empresa.",
      action: "Adicionar conhecimento",
      target: "knowledge" as const
    };
  }

  if (metrics.tickets === 0) {
    return {
      title: "Registre um pedido real",
      text: "Descreva o problema do cliente ou da area. A plataforma classifica prioridade e sugere o agente.",
      action: "Criar pedido",
      target: "tickets" as const
    };
  }

  if (metrics.agentRuns === 0) {
    return {
      title: "Gere a primeira resposta",
      text: "Escolha um agente, envie a tarefa e confira quais documentos sustentaram a resposta.",
      action: "Gerar resposta",
      target: "agents" as const
    };
  }

  if (metrics.pendingApprovals > 0) {
    return {
      title: "Revise respostas sensiveis",
      text: "Alguma resposta acionou politica de seguranca e precisa de decisao humana.",
      action: "Abrir revisoes",
      target: "approvals" as const
    };
  }

  return {
    title: "Confira a auditoria",
    text: "Veja qual agente rodou, qual contexto usou e quais controles foram aplicados.",
    action: "Ver auditoria",
    target: "audit" as const
  };
}

function GlossaryItem({ term, text }: { term: string; text: string }) {
  return (
    <div className="glossary-item">
      <strong>{term}</strong>
      <span>{text}</span>
    </div>
  );
}

function KnowledgeBase({
  documents,
  authRequiredWithoutKey,
  onChanged
}: {
  documents: DocumentRecord[];
  authRequiredWithoutKey: boolean;
  onChanged: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("atendimento, ia");
  const [classification, setClassification] = useState<DocumentRecord["classification"]>("internal");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function fillExample() {
    setTitle("Runbook de indisponibilidade do portal");
    setTags("incidente, suporte, portal");
    setClassification("internal");
    setContent(
      "Quando o portal de clientes estiver indisponivel, confirme o horario de inicio, impacto por cliente e sistemas afetados. Comunique que o time tecnico esta investigando, evite prometer prazo sem confirmacao e escale para IT Support se houver indisponibilidade geral."
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (authRequiredWithoutKey) {
      return;
    }
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
    if (!file || authRequiredWithoutKey) {
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
    <section className="view-grid">
      <PanelLead
        icon={BookOpenCheck}
        eyebrow="Passo 1"
        title="Ensine o que os agentes podem usar"
        text="Adicione regras, procedimentos e documentos aprovados. Sem essa base, a resposta fica menos ligada ao contexto da empresa."
      />
      {authRequiredWithoutKey ? <AccessCallout /> : null}
      <div className="split-layout">
      <form className="panel" onSubmit={(event) => void submit(event)}>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Novo conhecimento</span>
            <h2>Texto ou regra interna</h2>
          </div>
          <FileText size={20} />
        </div>
        <label>
          Nome do documento
          <span className="field-help">Exemplo: Politica de atendimento ou Runbook de incidente.</span>
          <input name="document-title" value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} autoComplete="off" required />
        </label>
        <label>
          Tags
          <span className="field-help">Separe assuntos por virgula para facilitar a busca.</span>
          <input name="document-tags" value={tags} onChange={(event) => setTags(event.target.value)} autoComplete="off" />
        </label>
        <label>
          Nivel de acesso
          <select name="document-classification" value={classification} onChange={(event) => setClassification(event.target.value as DocumentRecord["classification"])}>
            <option value="public">Publico</option>
            <option value="internal">Interno</option>
            <option value="confidential">Confidencial</option>
            <option value="restricted">Restrito</option>
          </select>
        </label>
        <label>
          Texto que o agente pode consultar
          <span className="field-help">Cole uma regra, procedimento ou orientacao. O agente usa esse texto como contexto.</span>
          <textarea name="document-content" value={content} onChange={(event) => setContent(event.target.value)} minLength={20} autoComplete="off" required />
        </label>
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={saving || authRequiredWithoutKey}>
            <CheckCircle2 size={18} />
            Adicionar conhecimento
          </button>
          <button className="secondary-button" type="button" disabled={saving} onClick={fillExample}>
            <FileCheck2 size={18} />
            Usar exemplo
          </button>
        </div>
        <div className="form-divider" />
        <label>
          Arquivo pronto
          <span className="field-help">Envie PDF, Word, Excel, Markdown, CSV ou texto quando ja tiver uma politica, planilha ou runbook.</span>
          <input
            name="document-file"
            type="file"
            accept=".pdf,.docx,.xlsx,.txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.yaml,.yml,.xml,.html,.htm,.log,.conf,.ini,.sql,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/markdown,application/markdown,text/csv,text/tab-separated-values,application/json,application/x-ndjson,application/yaml,application/x-yaml,text/html,application/xml,text/xml"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button className="secondary-button" type="button" disabled={saving || !file || authRequiredWithoutKey} onClick={() => void submitFile()}>
          <FileUp size={18} />
          Enviar arquivo
        </button>
      </form>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Base disponivel</span>
            <h2>Documentos que sustentam respostas</h2>
          </div>
          <span className="pill">{documents.length}</span>
        </div>
        <div className="document-list">
          {documents.map((document) => (
            <article className="document-row" key={document.id}>
              <strong>{document.title}</strong>
              <p>{document.content}</p>
              <div className="tag-row">
                <span>{classificationLabel(document.classification)}</span>
                <span>{document.chunks.length} trecho(s)</span>
              </div>
            </article>
          ))}
          {documents.length === 0 ? (
            <EmptyState title="Nenhum conhecimento cadastrado" text="Adicione um documento para que as respostas usem regras da empresa em vez de dependerem apenas do pedido." />
          ) : null}
        </div>
      </div>
      </div>
    </section>
  );
}

function TicketsPanel({
  tickets,
  authRequiredWithoutKey,
  onChanged
}: {
  tickets: Ticket[];
  authRequiredWithoutKey: boolean;
  onChanged: () => Promise<void>;
}) {
  const [subject, setSubject] = useState("");
  const [customer, setCustomer] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function fillExample() {
    setSubject("Portal de clientes fora do ar");
    setCustomer("Clientes enterprise");
    setDescription("Desde 09:20, clientes relatam erro 503 ao acessar o portal. O impacto parece geral e impede abertura de chamados.");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (authRequiredWithoutKey) {
      return;
    }
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
    <section className="view-grid">
      <PanelLead
        icon={Route}
        eyebrow="Passo 2"
        title="Registre o problema que precisa de resposta"
        text="O pedido vira entrada para triagem: severidade, agente recomendado e historico operacional."
      />
      {authRequiredWithoutKey ? <AccessCallout /> : null}
      <div className="split-layout">
      <form className="panel" onSubmit={(event) => void submit(event)}>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Novo pedido</span>
            <h2>Dados para triagem</h2>
          </div>
          <Workflow size={20} />
        </div>
        <label>
          Assunto do pedido
          <span className="field-help">Exemplo: Portal de clientes fora do ar.</span>
          <input name="ticket-subject" value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} autoComplete="off" required />
        </label>
        <label>
          Cliente ou area afetada
          <input name="ticket-customer" value={customer} onChange={(event) => setCustomer(event.target.value)} minLength={2} autoComplete="organization" required />
        </label>
        <label>
          O que aconteceu
          <span className="field-help">Inclua sintomas, impacto e horario aproximado para classificar melhor a severidade.</span>
          <textarea name="ticket-description" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} autoComplete="off" required />
        </label>
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={saving || authRequiredWithoutKey}>
            <Play size={18} />
            Criar pedido
          </button>
          <button className="secondary-button" type="button" disabled={saving} onClick={fillExample}>
            <ClipboardList size={18} />
            Usar exemplo
          </button>
        </div>
      </form>

      <div className="ticket-board">
        {tickets.map((ticket) => (
          <article className={`ticket-card severity-${ticket.severity}`} key={ticket.id}>
            <div className="ticket-topline">
              <strong>{ticket.subject}</strong>
              <span>{severityLabel(ticket.severity)}</span>
            </div>
            <p>{ticket.description}</p>
            <div className="tag-row">
              <span>{ticket.customer}</span>
              <span>{agentLabel(ticket.assignedAgent)}</span>
              <span>{ticketStatusLabel(ticket.status)}</span>
            </div>
          </article>
        ))}
        {tickets.length === 0 ? (
          <EmptyState title="Nenhum pedido registrado" text="Crie um pedido para ver a triagem automatica, o agente indicado e o status de atendimento." />
        ) : null}
      </div>
      </div>
    </section>
  );
}

function AgentsPanel({
  agents,
  runs,
  evaluations,
  authRequiredWithoutKey,
  onRun
}: {
  agents: AgentDefinition[];
  runs: AgentRun[];
  evaluations: AgentEvaluation[];
  authRequiredWithoutKey: boolean;
  onRun: () => Promise<void>;
}) {
  const [agentId, setAgentId] = useState<AgentId>("supervisor");
  const [prompt, setPrompt] = useState("Como devo responder um incidente critico de indisponibilidade?");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [latestRun, setLatestRun] = useState<AgentRun | null>(runs[0] ?? null);
  const selectedAgent = agents.find((agent) => agent.id === agentId);
  const latestEvaluation = latestRun ? evaluations.find((evaluation) => evaluation.runId === latestRun.id) : undefined;
  const promptExamples = [
    "Responda ao cliente sobre indisponibilidade do portal, com tom objetivo e sem prometer prazo.",
    "Classifique este pedido e diga qual agente deve assumir o atendimento.",
    "Revise esta resposta e aponte riscos de credenciais, dados sensiveis ou promessa indevida."
  ];

  useEffect(() => {
    if (!latestRun && runs[0]) {
      setLatestRun(runs[0]);
    }
  }, [latestRun, runs]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (authRequiredWithoutKey) {
      setRunError("Cole uma chave de acesso no topo para executar agentes.");
      return;
    }
    setRunning(true);
    setRunError("");
    try {
      const response = await api.runAgent(agentId, prompt);
      setLatestRun(response.data);
      setRunning(false);
      await onRun();
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : "Nao foi possivel gerar a resposta do agente.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="view-grid">
      <PanelLead
        icon={Send}
        eyebrow="Passo 3"
        title="Peça uma resposta e confira as evidencias"
        text="Escolha o papel certo para a tarefa. A resposta mostra o contexto consultado, alertas de seguranca e avaliacao."
      />
      {authRequiredWithoutKey ? <AccessCallout /> : null}
      <div className="split-layout agents-layout">
      <div className="agent-catalog" aria-label="Catalogo de agentes">
        {agents.map((agent) => (
          <button
            className={agentId === agent.id ? "agent-tile active" : "agent-tile"}
            key={agent.id}
            onClick={() => setAgentId(agent.id)}
            type="button"
          >
            <strong>{agent.name}</strong>
            <span>{agent.role}</span>
            <small>{agent.modelHint}</small>
          </button>
        ))}
        {agents.length === 0 ? <EmptyState title="Nenhum agente carregado" text="O catalogo publico de agentes nao retornou dados. Atualize a pagina ou confira a API." /> : null}
      </div>

      <form className="panel console-panel" onSubmit={(event) => void submit(event)}>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Resposta assistida</span>
            <h2>{selectedAgent ? agentLabel(selectedAgent.id) : "Escolha um agente"}</h2>
          </div>
          <Bot size={20} />
        </div>
        {selectedAgent ? (
          <div className="agent-role-note">
            <strong>{selectedAgent.role}</strong>
            <span>{selectedAgent.instructions}</span>
          </div>
        ) : null}
        <label>
          Quem deve responder
          <select name="agent-id" value={agentId} onChange={(event) => setAgentId(event.target.value as AgentId)}>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pergunta ou tarefa
          <span className="field-help">Use linguagem normal. A plataforma busca contexto, gera resposta e registra o historico.</span>
          <textarea name="agent-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} minLength={3} autoComplete="off" required />
        </label>
        <div className="prompt-suggestions" aria-label="Exemplos de perguntas">
          {promptExamples.map((example) => (
            <button className="suggestion-chip" type="button" key={example} onClick={() => setPrompt(example)}>
              {example}
            </button>
          ))}
        </div>
        <button className="primary-button" type="submit" disabled={running || authRequiredWithoutKey || agents.length === 0}>
          <Play size={18} />
          {running ? "Gerando..." : "Gerar resposta"}
        </button>

        {runError ? (
          <div className="provider-error" role="alert">
            <AlertCircle size={18} />
            <div>
              <strong>Erro ao chamar a IA</strong>
              <span>{runError}</span>
            </div>
          </div>
        ) : null}

        {latestRun ? (
          <div className="answer-box">
            <div className="tag-row">
              <span>{latestRun.latencyMs} ms</span>
              <span>{latestRun.retrievedContext.length} trechos consultados</span>
              {latestRun.tokenUsage?.totalTokens ? <span>{latestRun.tokenUsage.totalTokens} tokens</span> : null}
              {latestEvaluation ? <span>{latestEvaluation.overallScore}% qualidade</span> : null}
            </div>
            <strong className="answer-heading">Resposta do agente</strong>
            <pre>{latestRun.answer}</pre>
            <RunExplainabilityPanel run={latestRun} evaluation={latestEvaluation} />
          </div>
        ) : null}
      </form>
      </div>
    </section>
  );
}

function RunExplainabilityPanel({ run, evaluation }: { run: AgentRun; evaluation?: AgentEvaluation }) {
  const summary = run.reasoningSummary?.length ? run.reasoningSummary : buildFallbackRunSummary(run);

  return (
    <div className="explainability-panel">
      <div className="explainability-heading">
        <div>
          <span className="eyebrow">Como a IA chegou nisso</span>
          <strong>Resumo verificavel da execucao</strong>
        </div>
        <span className="pill">sem pensamento privado</span>
      </div>
      <p className="explainability-note">
        A tela mostra contexto usado, etapas executadas, avaliacao e alertas de seguranca. Ela nao exibe raciocinio privado.
      </p>

      <div className="reasoning-list">
        {summary.map((item, index) => (
          <div className="reasoning-item" key={`${run.id}-reason-${index}`}>
            <span>{index + 1}</span>
            <p>{item}</p>
          </div>
        ))}
      </div>

      <div className="trace-stack" aria-label="Etapas tecnicas executadas">
        {run.trace.spans.map((span) => (
          <span key={`${run.id}-${span.name}`}>
            {traceLabel(span.name)} {span.durationMs} ms
          </span>
        ))}
      </div>

      {run.retrievedContext.length > 0 ? (
        <div className="context-evidence">
          {run.retrievedContext.slice(0, 3).map((context, index) => (
            <article className="context-row" key={`${run.id}-${context.title}-${index}`}>
              <div>
                <strong>{context.title}</strong>
                <span>
                  {context.classification} - {Math.round(context.score * 100)}% similaridade
                </span>
              </div>
              <p>{context.content.slice(0, 260)}</p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Sem contexto recuperado" text="Cadastre documentos na base para que a resposta use evidencias internas." />
      )}

      {evaluation ? (
        <div className="score-strip">
          <span>Busca {evaluation.retrievalScore}%</span>
          <span>Baseado no contexto {evaluation.groundednessScore}%</span>
          <span>Seguranca {evaluation.safetyScore}%</span>
        </div>
      ) : null}

      <div className="flag-list">
        {run.safetyFlags.length > 0 ? (
          run.safetyFlags.map((flag) => (
            <span key={flag.code} title={flag.message}>
              {flag.code}
            </span>
          ))
        ) : (
          <span>Nenhum alerta de seguranca</span>
        )}
      </div>
    </div>
  );
}

function buildFallbackRunSummary(run: AgentRun) {
  return [
    run.retrievedContext.length > 0
      ? `Foram consultados ${run.retrievedContext.length} trecho(s) da base de conhecimento.`
      : "Nenhum trecho da base foi recuperado para esta pergunta.",
    "A resposta foi gerada e registrada com historico de execucao.",
    run.safetyFlags.length > 0
      ? `A governanca encontrou ${run.safetyFlags.length} alerta(s) de seguranca.`
      : "A governanca nao encontrou alerta de seguranca.",
    "O historico registrou etapas, duracao e dados de auditoria."
  ];
}

function traceLabel(name: string) {
  const labels: Record<string, string> = {
    "rag.retrieve": "Busca de contexto",
    "llm.generate": "Chamada da IA",
    "governance.evaluate": "Governanca"
  };
  return labels[name] ?? name;
}

function ApprovalsPanel({
  approvals,
  authRequiredWithoutKey,
  onChanged
}: {
  approvals: ApprovalRequest[];
  authRequiredWithoutKey: boolean;
  onChanged: () => Promise<void>;
}) {
  const [busyId, setBusyId] = useState("");

  async function decide(approval: ApprovalRequest, decision: "approved" | "rejected") {
    if (authRequiredWithoutKey) {
      return;
    }
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
      <PanelLead
        icon={ShieldCheck}
        eyebrow="Passo 4"
        title="Revise respostas antes de liberar"
        text="Respostas com credenciais, contexto restrito ou risco de seguranca ficam aqui para decisao humana."
      />
      {authRequiredWithoutKey ? <AccessCallout /> : null}
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Fila de revisao</span>
            <h2>Decisoes pendentes</h2>
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
                    disabled={busyId === approval.id || authRequiredWithoutKey}
                    onClick={() => void decide(approval, "approved")}
                  >
                    <CheckCircle2 size={18} />
                    Aprovar resposta
                  </button>
                  <button
                    className="reject-button"
                    type="button"
                    disabled={busyId === approval.id || authRequiredWithoutKey}
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
            <EmptyState title="Nenhuma revisao pendente" text="Quando uma resposta mencionar credencial, dado sensivel ou contexto restrito, ela aparece aqui antes de ser liberada." />
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
  authRequiredWithoutKey,
  onChanged
}: {
  auditEvents: AuditEvent[];
  policies: GovernancePolicy[];
  evaluations: AgentEvaluation[];
  outboxMessages: OutboxMessage[];
  authRequiredWithoutKey: boolean;
  onChanged: () => Promise<void>;
}) {
  const [dispatching, setDispatching] = useState(false);
  const pendingOutbox = outboxMessages.filter((message) => message.status === "pending").length;

  async function dispatchOutbox() {
    if (authRequiredWithoutKey) {
      return;
    }
    setDispatching(true);
    try {
      await api.dispatchOutbox();
      await onChanged();
    } finally {
      setDispatching(false);
    }
  }

  return (
    <section className="view-grid">
      <PanelLead
        icon={SearchCheck}
        eyebrow="Auditoria"
        title="Veja por que a resposta foi gerada"
        text="Use esta tela para conferir politicas, avaliacao de qualidade, eventos enviados e historico de execucoes."
      />
      {authRequiredWithoutKey ? <AccessCallout /> : null}
      <div className="split-layout">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Regras de seguranca</span>
            <h2>Politicas aplicadas</h2>
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
          <span className="eyebrow">Qualidade das respostas</span>
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
              <span className="eyebrow">Fila de eventos</span>
              <h2>Eventos para integracao</h2>
            </div>
            <button
              className="secondary-button"
              type="button"
              disabled={dispatching || pendingOutbox === 0 || authRequiredWithoutKey}
              onClick={() => void dispatchOutbox()}
            >
              <Play size={16} />
              Enviar eventos
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
            {outboxMessages.length === 0 ? <EmptyState title="Nenhum evento pendente" text="Eventos de auditoria e integracao aparecem aqui quando precisam ser enviados para outro sistema." /> : null}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Historico</span>
            <h2>Eventos auditados</h2>
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
          {auditEvents.length === 0 ? <EmptyState title="Nenhum evento auditado" text="Quando documentos, pedidos e agentes forem usados, o historico aparece aqui." /> : null}
        </div>
      </div>
      </div>
    </section>
  );
}

function PanelLead({
  icon: Icon,
  eyebrow,
  title,
  text
}: {
  icon: typeof Activity;
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="panel-lead">
      <div className="panel-lead-icon">
        <Icon size={22} />
      </div>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
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
      <span className="loading-dot" />
      <div>
        <strong>Carregando dados da plataforma</strong>
        <p>Buscando agentes, documentos, pedidos e auditoria.</p>
      </div>
    </div>
  );
}

function titleFor(view: View) {
  const titles: Record<View, string> = {
    command: "Painel de operacao",
    knowledge: "Conhecimento",
    tickets: "Pedidos",
    agents: "Responder com agentes",
    approvals: "Revisao humana",
    audit: "Auditoria"
  };
  return titles[view];
}

function summaryFor(view: View) {
  const summaries: Record<View, string> = {
    command: "Veja o proximo passo para sair de uma base vazia ate uma resposta revisada e auditavel.",
    knowledge: "Adicione regras, runbooks e politicas que os agentes podem consultar antes de responder.",
    tickets: "Registre o problema que precisa de resposta e deixe a plataforma classificar prioridade.",
    agents: "Escolha o papel certo, envie a tarefa e confira contexto, qualidade e seguranca.",
    approvals: "Decida se respostas sensiveis podem ser liberadas ou precisam ser rejeitadas.",
    audit: "Confira politicas, avaliacoes, eventos e historico de execucoes."
  };
  return summaries[view];
}

function agentLabel(value: AgentId) {
  const labels: Record<AgentId, string> = {
    supervisor: "Supervisor",
    support: "Atendimento",
    triage: "Triagem",
    "it-support": "Suporte tecnico",
    compliance: "Compliance"
  };
  return labels[value];
}

function classificationLabel(value: DocumentRecord["classification"]) {
  const labels: Record<DocumentRecord["classification"], string> = {
    public: "Publico",
    internal: "Interno",
    confidential: "Confidencial",
    restricted: "Restrito"
  };
  return labels[value];
}

function severityLabel(value: Ticket["severity"]) {
  const labels: Record<Ticket["severity"], string> = {
    low: "Baixa",
    medium: "Media",
    high: "Alta",
    critical: "Critica"
  };
  return labels[value];
}

function ticketStatusLabel(value: Ticket["status"]) {
  const labels: Record<Ticket["status"], string> = {
    new: "Novo",
    triaged: "Triado",
    needs_approval: "Requer revisao",
    answered: "Respondido"
  };
  return labels[value];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}
