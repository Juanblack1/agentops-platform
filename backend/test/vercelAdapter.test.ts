import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env";

describe("Vercel adapter defaults", () => {
  it("keeps provider inference available when a Google API key is configured", async () => {
    const apiModule = await import(new URL("../../api/index.ts", import.meta.url).href);
    const applyVercelDefaults: (source: NodeJS.ProcessEnv) => void = apiModule.applyVercelDefaults;
    const source: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      VERCEL: "1",
      GOOGLE_GENERATIVE_AI_API_KEY: "test-google-ai-studio-key"
    };

    applyVercelDefaults(source);
    const config = loadConfig(source);

    expect(config.LLM_PROVIDER).toBe("google");
  });

  it("keeps mock mode as the serverless fallback when no provider key exists", async () => {
    const apiModule = await import(new URL("../../api/index.ts", import.meta.url).href);
    const applyVercelDefaults: (source: NodeJS.ProcessEnv) => void = apiModule.applyVercelDefaults;
    const source: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      VERCEL: "1"
    };

    applyVercelDefaults(source);
    const config = loadConfig(source);

    expect(config.LLM_PROVIDER).toBe("mock");
  });
});
