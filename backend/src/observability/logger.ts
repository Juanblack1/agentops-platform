import pino from "pino";
import type { AppConfig } from "../config/env";

export function createLogger(config: AppConfig) {
  return pino({
    level: config.LOG_LEVEL,
    base: {
      service: "agentops-backend",
      environment: config.NODE_ENV
    }
  });
}
