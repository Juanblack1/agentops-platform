import {
  Activity,
  AlertCircle,
  Bot,
  Boxes,
  CheckCircle2,
  ClipboardList,
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
  { id: "command", label: "Inicio", icon: Activity },
  { id: "knowledge", label: "Base de conhecimento", icon: Database },
  { id: "tickets", label: "Tickets", icon: ClipboardList },
  { id: "agents", label: "Agentes", icon: Bot },
  { id: "approvals", label: "Revisao humana", icon: ShieldCheck },
  { id: "audit", label: "Auditoria", icon: ShieldCheck }
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
          <strong>{mastra ? "Agentes prontos" : "Aguardando API"}</strong>
          <small>{mastra?.registeredAgents.length ?? 0} agentes disponiveis</small>
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
              <span>{system ? `${llmProviderLabel(system.llmProvider)} / ${vectorStoreLabel(system.vectorStore)}` : "Conectando"}</span>
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
            mastra={mastra}
            system={system}
            hasOperationalData={hasOperationalData}
            authRequiredWithoutKey={authRequiredWithoutKey}
            loading={loading}
            onNavigate={setActiveView}
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
  system,
  hasOperationalData,
  authRequiredWithoutKey,
  loading,
  onNavigate
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
  hasOperationalData: boolean;
  authRequiredWithoutKey: boolean;
  loading: boolean;
  onNavigate: (view: View) => void;
}) {
  const nextStep = getCommandNextStep(metrics, authRequiredWithoutKey);
  const guideSteps = [
    {
      number: "1",
      icon: Database,
      title: "Carregue conhecimento",
      text: "Adicione PDFs, planilhas, documentos ou textos que os agentes podem consultar antes de responder.",
      action: "Abrir base",
      done: metrics.documents > 0,
      status: metrics.documents > 0 ? `${metrics.documents} documento(s)` : "Pendente",
      onClick: () => onNavigate("knowledge")
    },
    {
      number: "2",
      icon: ClipboardList,
      title: "Crie um ticket",
      text: "Descreva o problema em linguagem simples. A plataforma classifica severidade e sugere o agente.",
      action: "Criar ticket",
      done: metrics.tickets > 0,
      status: metrics.tickets > 0 ? `${metrics.tickets} ticket(s)` : "Pendente",
      onClick: () => onNavigate("tickets")
    },
    {
      number: "3",
      icon: Bot,
      title: "Execute um agente",
      text: "Escolha o agente, envie a pergunta e veja resposta, contexto usado, etapas tecnicas e qualidade.",
      action: "Usar agente",
      done: metrics.agentRuns > 0,
      status: metrics.agentRuns > 0 ? `${metrics.agentRuns} execucao(oes)` : "Pendente",
      onClick: () => onNavigate("agents")
    },
    {
      number: "4",
      icon: ShieldCheck,
      title: "Revise e audite",
      text: "Aprove respostas sensiveis e confira a trilha de auditoria para entender o que aconteceu.",
      action: "Ver auditoria",
      done: metrics.evaluations > 0 || metrics.auditEvents > 0,
      status: metrics.pendingApprovals > 0 ? `${metrics.pendingApprovals} pendente(s)` : metrics.auditEvents > 0 ? "Auditado" : "Pendente",
      onClick: () => onNavigate(metrics.pendingApprovals > 0 ? "approvals" : "audit")
    }
  ];

  function runNextStep() {
    onNavigate(nextStep.target);
  }

  return (
    <section className="view-grid">
      <div className="intro-panel">
        <div className="intro-copy">
          <span className="eyebrow">O que este app faz</span>
          <h2>Um painel de producao para operar agentes de IA com documentos, tickets, revisao humana e auditoria.</h2>
          <p>
            Cadastre conhecimento da empresa, abra pedidos reais, pergunte aos agentes e revise respostas sensiveis antes
            de liberar qualquer acao operacional.
          </p>
          <div className="intro-actions">
            <button
              className="primary-button"
              type="button"
              disabled={loading || authRequiredWithoutKey}
              onClick={() => onNavigate("knowledge")}
            >
              <Database size={18} />
              Adicionar documento
            </button>
            <button className="secondary-button" type="button" disabled={loading || authRequiredWithoutKey} onClick={() => onNavigate("tickets")}>
              <ClipboardList size={18} />
              Criar ticket
            </button>
          </div>
        </div>

        <div className="intro-proof" aria-label="Resumo do fluxo">
          <strong>Fluxo de producao</strong>
          <span>1. Cadastre documentos aprovados pela empresa.</span>
          <span>2. Registre tickets com cliente, impacto e sintomas.</span>
          <span>3. Execute agentes com contexto recuperado do pgvector.</span>
          <span>4. Revise riscos e acompanhe auditoria.</span>
        </div>
      </div>

      <div className="next-step-panel">
        <div>
          <span className="eyebrow">Proximo passo</span>
          <strong>{nextStep.title}</strong>
          <p>{nextStep.text}</p>
        </div>
        <button className="primary-button" type="button" disabled={loading || authRequiredWithoutKey} onClick={runNextStep}>
          <Play size={18} />
          {nextStep.action}
        </button>
      </div>

      <div className="guide-grid" aria-label="Passo a passo recomendado">
        {guideSteps.map((step) => (
          <GuideStep key={step.number} {...step} />
        ))}
      </div>

      <div className="metric-grid">
        <Metric icon={Database} label="Conhecimento" value={metrics.documents} tone="green" />
        <Metric icon={ClipboardList} label="Tickets" value={metrics.tickets} tone="orange" />
        <Metric icon={Bot} label="Agentes usados" value={metrics.agentRuns} tone="blue" />
        <Metric icon={Gauge} label="Qualidade media" value={metrics.averageQualityScore} suffix="%" tone="green" />
        <Metric icon={Cpu} label="Tempo medio" value={metrics.averageLatencyMs} suffix=" ms" tone="blue" />
        <Metric icon={Workflow} label="Traces" value={metrics.tracedRuns} tone="orange" />
        <Metric icon={Server} label="Eventos pendentes" value={metrics.outboxPending + metrics.outboxFailed} tone="red" />
        <Metric
          icon={Siren}
          label="Acoes pendentes"
          value={criticalTickets + ticketApprovalCount + metrics.pendingApprovals + metrics.outboxPending + metrics.outboxFailed}
          tone="red"
        />
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
                    <span>trace {run.traceId.slice(0, 8)}</span>
                    <span>{run.provider}</span>
                    {run.tokenUsage?.totalTokens ? <span>{run.tokenUsage.totalTokens} tokens</span> : null}
                  </div>
                </div>
                <span>{run.model}</span>
              </article>
            ))}
            {runs.length === 0 ? (
              <EmptyState
                title={hasOperationalData ? "Nenhum agente executado" : "Nenhuma execucao registrada"}
                text={
                  hasOperationalData
                    ? "Abra o console de agentes para gerar uma resposta com contexto, avaliacao e auditoria."
                    : "Cadastre conhecimento e crie um ticket para iniciar o fluxo operacional."
                }
              />
            ) : null}
          </div>
        </div>

        <div className="panel runtime-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Por tras da tela</span>
              <h2>Como a plataforma esta rodando</h2>
            </div>
            <span className={system ? "status-dot ok" : "status-dot"} aria-label={system ? "Backend disponivel" : "Backend indisponivel"} />
          </div>
          <div className="runtime-grid">
            <RuntimeItem label="IA usada" value={llmProviderLabel(system?.llmProvider)} />
            <RuntimeItem label="Modelo" value={system?.llmModel ?? mastra?.model ?? "Aguardando"} />
            <RuntimeItem label="Dados" value={dataStoreLabel(system?.dataStore)} />
            <RuntimeItem label="Busca de contexto" value={vectorStoreLabel(system?.vectorStore)} />
          </div>
          <div className="provider-note">
            <ShieldCheck size={18} />
            <span>
              {system?.llmProvider === "google"
                ? "Google Gemini esta ativo por padrao no backend. A chave do Google AI Studio fica protegida no ambiente da Vercel, nunca no navegador."
                : "O backend esta sem provedor de IA real. Configure a chave do Google AI Studio antes de operar em producao."}
            </span>
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
          <div className="glossary-list">
            <GlossaryItem term="Agente" text="Um papel especializado, como suporte, TI ou compliance." />
            <GlossaryItem term="Contexto" text="Trechos dos documentos que a IA consulta antes de responder." />
            <GlossaryItem term="Revisao humana" text="Etapa que segura respostas sensiveis ate alguem aprovar." />
            <GlossaryItem term="Auditoria" text="Registro das decisoes, eventos e traces de cada execucao." />
          </div>
        </div>
      </div>
    </section>
  );
}

function GuideStep({
  number,
  icon: Icon,
  title,
  text,
  action,
  done,
  status,
  onClick
}: {
  number: string;
  icon: typeof Activity;
  title: string;
  text: string;
  action: string;
  done: boolean;
  status: string;
  onClick: () => void;
}) {
  return (
    <article className={done ? "guide-card done" : "guide-card"}>
      <div className="guide-number">{number}</div>
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

function getCommandNextStep(metrics: PlatformMetrics, authRequiredWithoutKey: boolean) {
  if (authRequiredWithoutKey) {
    return {
      title: "Informe a chave de acesso",
      text: "A API de producao exige uma chave operacional. Use uma chave de operador, revisor ou administrador.",
      action: "Usar chave",
      target: "knowledge" as const
    };
  }

  if (metrics.documents === 0) {
    return {
      title: "Cadastre o primeiro documento",
      text: "Os agentes precisam de politicas, runbooks ou procedimentos reais para responder com base no contexto da empresa.",
      action: "Adicionar documento",
      target: "knowledge" as const
    };
  }

  if (metrics.tickets === 0) {
    return {
      title: "Crie um ticket operacional",
      text: "Use uma frase simples sobre um problema do cliente. A plataforma faz a triagem automaticamente.",
      action: "Criar ticket",
      target: "tickets" as const
    };
  }

  if (metrics.agentRuns === 0) {
    return {
      title: "Pergunte a um agente",
      text: "O console mostra a resposta, os documentos consultados, a avaliacao e o trace tecnico.",
      action: "Usar agente",
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
    text: "Use a auditoria para provar qual agente rodou, qual contexto usou e quais controles foram aplicados.",
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
            <span className="eyebrow">Passo 1</span>
            <h2>Conhecimento para os agentes</h2>
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
        <button className="primary-button" type="submit" disabled={saving}>
          <CheckCircle2 size={18} />
          Adicionar a base
        </button>
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
        <button className="secondary-button" type="button" disabled={saving || !file} onClick={() => void submitFile()}>
          <FileUp size={18} />
          Enviar documento
        </button>
      </form>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">O que a IA sabe</span>
            <h2>Documentos carregados</h2>
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
            <EmptyState title="Base vazia" text="Adicione pelo menos um documento. Sem isso, o agente responde com menos contexto sobre a empresa." />
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
            <span className="eyebrow">Passo 2</span>
            <h2>Pedido para triagem</h2>
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
          <span className="field-help">Descreva sintomas, impacto e horario aproximado. O agente usa isso para classificar severidade.</span>
          <textarea name="ticket-description" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} autoComplete="off" required />
        </label>
        <button className="primary-button" type="submit" disabled={saving}>
          <Play size={18} />
          Criar e triar ticket
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
          <EmptyState title="Nenhum ticket" text="Crie um pedido para ver como a plataforma classifica severidade, escolhe agente e registra auditoria." />
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
  const [runError, setRunError] = useState("");
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
            <span className="eyebrow">Passo 3</span>
            <h2>Perguntar a um agente</h2>
          </div>
          <Bot size={20} />
        </div>
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
          <span className="field-help">Use linguagem normal. O sistema recupera contexto, chama o modelo e registra a execucao.</span>
          <textarea name="agent-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} minLength={3} autoComplete="off" required />
        </label>
        <button className="primary-button" type="submit" disabled={running}>
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
              <span>trace {latestRun.traceId.slice(0, 8)}</span>
              <span>{latestRun.provider}</span>
              <span>{latestRun.model}</span>
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
        A tela mostra contexto usado, etapas tecnicas, avaliacao e erros seguros do provedor. Ela nao exibe cadeia de pensamento
        interna do modelo.
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
    `A resposta foi gerada por ${llmProviderLabel(run.provider)} usando ${run.model}.`,
    run.safetyFlags.length > 0
      ? `A governanca encontrou ${run.safetyFlags.length} alerta(s) de seguranca.`
      : "A governanca nao encontrou alerta de seguranca.",
    "O trace registrou as etapas tecnicas, duracao e metadados da execucao."
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
            <span className="eyebrow">Passo 4</span>
            <h2>Respostas que precisam de revisao</h2>
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
              disabled={dispatching || pendingOutbox === 0}
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
        </div>
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
      <span className="loading-dot" />
      <div>
        <strong>Carregando dados da plataforma</strong>
        <p>Buscando agentes, documentos, tickets e auditoria.</p>
      </div>
    </div>
  );
}

function titleFor(view: View) {
  const titles: Record<View, string> = {
    command: "Fluxo guiado da plataforma",
    knowledge: "Base de conhecimento",
    tickets: "Triagem de tickets",
    agents: "Console de agentes",
    approvals: "Revisao humana",
    audit: "Auditoria e governanca"
  };
  return titles[view];
}

function summaryFor(view: View) {
  const summaries: Record<View, string> = {
    command: "Siga os passos para entender como documentos, tickets, agentes, revisao humana e auditoria trabalham juntos.",
    knowledge: "Cadastre regras, runbooks e politicas para que os agentes respondam com base no conhecimento da empresa.",
    tickets: "Abra um pedido ou incidente para ver classificacao de severidade, responsavel e status.",
    agents: "Escolha um agente, envie uma pergunta e veja a resposta com contexto, tempo, qualidade e seguranca.",
    approvals: "Revise respostas que envolvem dados sensiveis, credenciais ou contexto restrito antes de liberar.",
    audit: "Acompanhe politicas, avaliacoes e eventos que provam o que aconteceu em cada execucao."
  };
  return summaries[view];
}

function llmProviderLabel(value?: string) {
  const labels: Record<string, string> = {
    mock: "IA simulada",
    google: "Gemini",
    litellm: "LiteLLM"
  };
  return value ? (labels[value] ?? value) : "Aguardando";
}

function dataStoreLabel(value?: string) {
  const labels: Record<string, string> = {
    memory: "Temporario",
    file: "Arquivo local",
    postgres: "PostgreSQL"
  };
  return value ? (labels[value] ?? value) : "Aguardando";
}

function vectorStoreLabel(value?: string) {
  const labels: Record<string, string> = {
    memory: "Contexto temporario",
    qdrant: "Qdrant",
    pgvector: "pgvector"
  };
  return value ? (labels[value] ?? value) : "Aguardando";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}
