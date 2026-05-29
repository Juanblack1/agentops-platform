import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env";

describe("runtime configuration", () => {
  it("uses Google Gemini by default when a Google AI Studio key is configured", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      GOOGLE_GENERATIVE_AI_API_KEY: "test-google-ai-studio-key"
    } as NodeJS.ProcessEnv);

    expect(config.LLM_PROVIDER).toBe("google");
  });

  it("keeps an explicit mock provider even when a Google key exists", () => {
    const config = loadConfig({
      NODE_ENV: "development",
      LLM_PROVIDER: "mock",
      GOOGLE_GENERATIVE_AI_API_KEY: "test-google-ai-studio-key"
    } as NodeJS.ProcessEnv);

    expect(config.LLM_PROVIDER).toBe("mock");
  });

  it("uses writable temp paths for Vercel serverless defaults", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      VERCEL: "1"
    } as NodeJS.ProcessEnv);

    expect(config.DATA_FILE_PATH).toBe("/tmp/agentops-store.json");
    expect(config.DOCUMENT_STORAGE_DIR).toBe("/tmp/agentops-uploads");
  });
});
