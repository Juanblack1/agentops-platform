import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Vercel } from "@vercel/sdk";
import { readVercelToken } from "./vercel-auth.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const managedKeys = [
  "LLM_PROVIDER",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_GENERATIVE_AI_MODEL",
  "MASTRA_MODEL",
  "API_KEYS",
  "VITE_AGENTOPS_DEFAULT_API_KEY"
];
const requiredKeys = [
  "LLM_PROVIDER",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_GENERATIVE_AI_MODEL",
  "MASTRA_MODEL",
  "API_KEYS",
  "VITE_AGENTOPS_DEFAULT_API_KEY"
];

const project = JSON.parse(await readFile(join(rootDir, ".vercel", "project.json"), "utf8"));
const localEnv = parseDotenv(await readFile(join(rootDir, "backend", ".env"), "utf8"));
const adminApiKey = await readOptionalText(join(rootDir, "backend", ".env.local.admin-key"));
const token = await readVercelToken();

const values = {
  LLM_PROVIDER: valueOf("LLM_PROVIDER", "google"),
  GOOGLE_GENERATIVE_AI_API_KEY: valueOf("GOOGLE_GENERATIVE_AI_API_KEY"),
  GOOGLE_GENERATIVE_AI_MODEL: valueOf("GOOGLE_GENERATIVE_AI_MODEL", "gemini-2.5-flash"),
  MASTRA_MODEL: valueOf("MASTRA_MODEL", "google/gemini-2.5-flash"),
  API_KEYS: valueOf("API_KEYS", adminApiKey ? `admin:${adminApiKey}` : undefined),
  VITE_AGENTOPS_DEFAULT_API_KEY: valueOf("VITE_AGENTOPS_DEFAULT_API_KEY", adminApiKey || undefined)
};

for (const key of requiredKeys) {
  if (!values[key]) {
    throw new Error(`${key} is required before syncing Vercel env.`);
  }
}

const keysToSync = managedKeys.filter((key) => requiredKeys.includes(key) || Boolean(values[key]));

const target = process.env.VERCEL_ENV_TARGET ?? "production";
const vercel = new Vercel({ bearerToken: token });

await vercel.projects.createProjectEnv({
  idOrName: process.env.VERCEL_PROJECT_ID ?? project.projectId,
  teamId: process.env.VERCEL_TEAM_ID ?? project.orgId,
  upsert: "true",
  requestBody: keysToSync.map((key) => ({
    key,
    value: values[key],
    target: [target],
    type: "encrypted",
    comment: "Managed by npm run vercel:sync-env"
  }))
});

console.log(
  JSON.stringify(
    {
      project: project.projectName,
      target,
      synced: keysToSync,
      valuesPrinted: false
    },
    null,
    2
  )
);

function valueOf(key, fallback) {
  return process.env[key] ?? localEnv[key] ?? fallback ?? "";
}

function parseDotenv(raw) {
  const values = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

async function readOptionalText(path) {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}
