import type { AgentId, Ticket, TicketSeverity } from "../domain/types";

export interface TriageDecision {
  severity: TicketSeverity;
  assignedAgent: AgentId;
  status: Ticket["status"];
  rationale: string;
}

export function runTriageWorkflow(input: Pick<Ticket, "subject" | "description">): TriageDecision {
  const text = `${input.subject} ${input.description}`.toLowerCase();

  if (/(fora|indisponivel|indisponibilidade|queda|parado|p1|critico|vazamento)/i.test(text)) {
    return {
      severity: "critical",
      assignedAgent: "it-support",
      status: "triaged",
      rationale: "Termos indicam indisponibilidade, incidente tecnico ou risco operacional alto."
    };
  }

  if (/(lgpd|contrato|juridico|auditoria|compliance|dado sensivel|privacidade)/i.test(text)) {
    return {
      severity: "high",
      assignedAgent: "compliance",
      status: "needs_approval",
      rationale: "Demanda envolve compliance, privacidade ou risco juridico."
    };
  }

  if (/(erro|falha|lento|timeout|login|acesso)/i.test(text)) {
    return {
      severity: "medium",
      assignedAgent: "it-support",
      status: "triaged",
      rationale: "Demanda tecnica com impacto moderado."
    };
  }

  return {
    severity: "low",
    assignedAgent: "support",
    status: "triaged",
    rationale: "Demanda de atendimento sem sinais de criticidade."
  };
}
