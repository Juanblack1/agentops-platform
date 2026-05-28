import type { FastifyRequest } from "fastify";
import { createHash, timingSafeEqual } from "node:crypto";
import type { AppConfig } from "../config/env";

export type ApiRole = "operator" | "reviewer" | "admin";

export interface ApiPrincipal {
  role: ApiRole;
  source: "legacy" | "mapped";
}

export function authIsEnabled(config: AppConfig) {
  return Boolean(config.API_KEY || config.API_KEYS);
}

export function resolveApiPrincipal(config: AppConfig, apiKeyHeader: unknown): ApiPrincipal | null {
  const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;

  if (typeof apiKey !== "string" || !apiKey) {
    return null;
  }

  if (config.API_KEY && secureCompare(apiKey, config.API_KEY)) {
    return {
      role: "admin",
      source: "legacy"
    };
  }

  for (const entry of parseApiKeys(config.API_KEYS)) {
    if (secureCompare(entry.key, apiKey)) {
      return {
        role: entry.role,
        source: "mapped"
      };
    }
  }

  return null;
}

export function getRequestRole(request: FastifyRequest): ApiRole | "anonymous" {
  const role = request.headers["x-agentops-role"];

  if (role === "operator" || role === "reviewer" || role === "admin") {
    return role;
  }

  return "anonymous";
}

export function parseApiKeys(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [role, ...keyParts] = entry.split(":");
      const key = keyParts.join(":");

      if (role !== "operator" && role !== "reviewer" && role !== "admin") {
        return null;
      }

      if (!key) {
        return null;
      }

      return {
        role,
        key
      };
    })
    .filter((entry): entry is { role: ApiRole; key: string } => Boolean(entry));
}

function secureCompare(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}
