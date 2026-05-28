import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import type { AgentDefinition, LlmProvider, RetrievedContext, TokenUsage } from "../domain/types";

export interface GenerateRequest {
  agent: AgentDefinition;
  prompt: string;
  context: RetrievedContext[];
}

export interface GenerateResponse {
  answer: string;
  model: string;
  provider: LlmProvider;
  tokenUsage?: TokenUsage;
  latencyMs: number;
}

export interface LlmGateway {
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}

export class MockLlmGateway implements LlmGateway {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startedAt = performance.now();
    const contextSummary =
      request.context.length === 0
        ? "Nao encontrei contexto cadastrado para essa pergunta."
        : request.context
            .slice(0, 3)
            .map((context, index) => `${index + 1}. ${context.title}: ${context.content.slice(0, 220)}`)
            .join("\n");

    const answer = [
      `Resposta simulada do ${request.agent.name}.`,
      "",
      "Leitura operacional:",
      contextSummary,
      "",
      "Proximo passo recomendado:",
      buildNextStep(request.prompt)
    ].join("\n");

    return {
      answer,
      model: "mock-local",
      provider: "mock",
      tokenUsage: estimateLocalTokenUsage(request.prompt, contextSummary, answer),
      latencyMs: Math.round(performance.now() - startedAt)
    };
  }
}

export class LiteLlmGateway implements LlmGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startedAt = performance.now();
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(request.agent, request.context)
          },
          {
            role: "user",
            content: request.prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`LiteLLM request failed with status ${response.status}: ${message}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    return {
      answer: data.choices?.[0]?.message?.content ?? "LiteLLM retornou uma resposta vazia.",
      model: data.model ?? this.model,
      provider: "litellm",
      tokenUsage: {
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens
      },
      latencyMs: Math.round(performance.now() - startedAt)
    };
  }
}

export class GoogleLlmGateway implements LlmGateway {
  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startedAt = performance.now();
    const google = createGoogleGenerativeAI({
      apiKey: this.apiKey
    });

    const result = await generateText({
      model: google(this.model),
      system: buildSystemPrompt(request.agent, request.context),
      prompt: request.prompt,
      temperature: 0.2,
      maxOutputTokens: 900,
      maxRetries: 1
    });

    return {
      answer: result.text || "Google Gemini retornou uma resposta vazia.",
      model: this.model,
      provider: "google",
      tokenUsage: {
        inputTokens: result.totalUsage.inputTokens,
        outputTokens: result.totalUsage.outputTokens,
        totalTokens: result.totalUsage.totalTokens
      },
      latencyMs: Math.round(performance.now() - startedAt)
    };
  }
}

function buildSystemPrompt(agent: AgentDefinition, context: RetrievedContext[]) {
  return [
    agent.instructions,
    "",
    "Regras obrigatorias:",
    "- Use somente o contexto fornecido quando citar politicas internas.",
    "- Se o contexto for insuficiente, declare a lacuna.",
    "- Nao exponha segredos, tokens ou dados sensiveis.",
    "- Responda em portugues do Brasil.",
    "",
    "Contexto RAG:",
    context.length === 0
      ? "Nenhum contexto recuperado."
      : context
          .map((item, index) => `[${index + 1}] ${item.title} (${item.classification})\n${item.content}`)
          .join("\n\n")
  ].join("\n");
}

function buildNextStep(prompt: string) {
  const normalized = prompt.toLowerCase();

  if (normalized.includes("fora") || normalized.includes("indispon")) {
    return "Abrir incidente P1, acionar IT Support Agent e registrar comunicacao para stakeholders.";
  }

  if (normalized.includes("contrato") || normalized.includes("lgpd") || normalized.includes("dado")) {
    return "Encaminhar para Compliance Agent antes de enviar qualquer resposta externa.";
  }

  return "Validar a resposta com o contexto recuperado e registrar a execucao na trilha de auditoria.";
}

function estimateLocalTokenUsage(prompt: string, context: string, answer: string): TokenUsage {
  const inputTokens = estimateTokens(`${prompt}\n${context}`);
  const outputTokens = estimateTokens(answer);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens
  };
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}
