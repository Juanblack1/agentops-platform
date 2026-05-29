import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env";

describe("runtime configuration", () => {
  it("uses writable temp paths for Vercel serverless defaults", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      VERCEL: "1",
      SEED_DEMO_DATA: "false"
    } as NodeJS.ProcessEnv);

    expect(config.DATA_FILE_PATH).toBe("/tmp/agentops-store.json");
    expect(config.DOCUMENT_STORAGE_DIR).toBe("/tmp/agentops-uploads");
  });
});
