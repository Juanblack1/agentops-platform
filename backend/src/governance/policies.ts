import type { RetrievedContext, SafetyFlag } from "../domain/types";

export function evaluateGovernance(prompt: string, answer: string, context: RetrievedContext[]): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  const combined = `${prompt}\n${answer}`.toLowerCase();

  if (/(\bapi[_-]?key\b|\btoken\b|\bpassword\b|\bsenha\b|\bsecret\b)/i.test(combined)) {
    flags.push({
      code: "secret.reference",
      severity: "high",
      message: "A execucao menciona credenciais ou segredos e precisa de revisao."
    });
  }

  if (context.length === 0) {
    flags.push({
      code: "rag.context.empty",
      severity: "low",
      message: "Nenhum contexto RAG foi recuperado para fundamentar a resposta."
    });
  }

  if (context.some((item) => item.classification === "restricted")) {
    flags.push({
      code: "restricted.context.used",
      severity: "medium",
      message: "A resposta usou contexto classificado como restrito."
    });
  }

  if (/(garantimos|100%|sem risco|certeza absoluta)/i.test(answer)) {
    flags.push({
      code: "overconfident.answer",
      severity: "medium",
      message: "A resposta contem linguagem absoluta e deve ser revisada."
    });
  }

  return flags;
}

export function requiresApproval(flags: SafetyFlag[]) {
  return flags.some((flag) => flag.severity === "high" || flag.severity === "critical");
}

export const governancePolicies = [
  {
    id: "no-secret-disclosure",
    name: "Bloqueio de segredos",
    description: "Respostas que mencionam tokens, senhas ou API keys exigem revisao humana."
  },
  {
    id: "rag-grounding",
    name: "Grounding por RAG",
    description: "Respostas corporativas devem informar quando nao houver contexto suficiente."
  },
  {
    id: "restricted-context",
    name: "Contexto restrito",
    description: "Uso de documentos restritos deve ser auditado e pode exigir aprovacao."
  }
];
