import { SpanStatusCode, trace, type Span } from "@opentelemetry/api";

const tracer = trace.getTracer(process.env.OTEL_SERVICE_NAME ?? "agentops-backend");

export async function withSpan<T>(name: string, attributes: Record<string, string | number | boolean>, fn: (span: Span) => Promise<T>) {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }

      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
