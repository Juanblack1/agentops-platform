import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export async function readVercelToken() {
  if (process.env.VERCEL_TOKEN) {
    return process.env.VERCEL_TOKEN.trim();
  }

  const candidates = [
    process.env.VERCEL_AUTH_FILE,
    process.env.APPDATA ? join(process.env.APPDATA, "com.vercel.cli", "Data", "auth.json") : null,
    join(homedir(), ".vercel", "auth.json")
  ].filter(Boolean);

  for (const authPath of candidates) {
    try {
      const raw = await readFile(authPath, "utf8");
      const parsed = JSON.parse(raw);
      if (typeof parsed.token === "string" && parsed.token.trim()) {
        return parsed.token.trim();
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw new Error(`Could not read Vercel auth file at ${authPath}: ${error.message}`);
      }
    }
  }

  throw new Error("VERCEL_TOKEN is not set and no Vercel CLI auth token was found.");
}
