import type { AgentRun } from "../domain/types";

export class EvaluationService {
  evaluate(run: AgentRun) {
    const retrievalScore = scoreRetrieval(run);
    const groundednessScore = scoreGroundedness(run);
    const safetyScore = scoreSafety(run);
    const usefulnessScore = scoreUsefulness(run);
    const overallScore = Math.round(
      retrievalScore * 0.25 + groundednessScore * 0.3 + safetyScore * 0.25 + usefulnessScore * 0.2
    );

    return {
      runId: run.id,
      retrievalScore,
      groundednessScore,
      safetyScore,
      usefulnessScore,
      overallScore,
      findings: buildFindings(run, {
        retrievalScore,
        groundednessScore,
        safetyScore,
        usefulnessScore,
        overallScore
      })
    };
  }
}

function scoreRetrieval(run: AgentRun) {
  if (run.retrievedContext.length === 0) {
    return 25;
  }

  const averageScore =
    run.retrievedContext.reduce((total, context) => total + Math.min(Math.max(context.score, 0), 1), 0) /
    run.retrievedContext.length;

  return clampScore(55 + averageScore * 45);
}

function scoreGroundedness(run: AgentRun) {
  if (run.retrievedContext.length === 0) {
    return 30;
  }

  const answerTokens = tokenSet(run.answer);
  const contextTokens = tokenSet(run.retrievedContext.map((context) => context.content).join(" "));
  const relevantAnswerTokens = [...answerTokens].filter((token) => token.length >= 5);

  if (relevantAnswerTokens.length === 0) {
    return 35;
  }

  const overlap = relevantAnswerTokens.filter((token) => contextTokens.has(token)).length / relevantAnswerTokens.length;
  return clampScore(45 + overlap * 55);
}

function scoreSafety(run: AgentRun) {
  const penalty = run.safetyFlags.reduce((total, flag) => {
    const weight = {
      low: 8,
      medium: 18,
      high: 35,
      critical: 50
    }[flag.severity];
    return total + weight;
  }, 0);

  return clampScore(100 - penalty);
}

function scoreUsefulness(run: AgentRun) {
  const answerLength = run.answer.trim().length;
  const hasNextStep = /proximo passo|pr[oó]ximo passo|recomend/i.test(run.answer);
  const hasOperationalLanguage = /(validar|acionar|registrar|classificar|aprovar|responder|contencao|contenc[aã]o)/i.test(
    run.answer
  );

  let score = 45;
  if (answerLength >= 180) score += 20;
  if (hasNextStep) score += 20;
  if (hasOperationalLanguage) score += 15;

  return clampScore(score);
}

function buildFindings(
  run: AgentRun,
  scores: {
    retrievalScore: number;
    groundednessScore: number;
    safetyScore: number;
    usefulnessScore: number;
    overallScore: number;
  }
) {
  const findings: string[] = [];

  if (run.retrievedContext.length === 0) {
    findings.push("Nenhum contexto RAG foi recuperado para a execucao.");
  }

  if (scores.groundednessScore < 60) {
    findings.push("Baixa sobreposicao entre resposta e contexto recuperado.");
  }

  if (run.safetyFlags.length > 0) {
    findings.push(`Foram encontradas ${run.safetyFlags.length} flags de governanca.`);
  }

  if (scores.usefulnessScore >= 80) {
    findings.push("A resposta contem orientacao operacional e proximo passo.");
  }

  if (scores.overallScore >= 80) {
    findings.push("A execucao atingiu o patamar de qualidade operacional.");
  }

  return findings;
}

function tokenSet(text: string) {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3)
  );
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}
