import { loadConfig } from "./config/env";
import { buildServer } from "./server";

const config = loadConfig();
const app = await buildServer(config);

try {
  await app.listen({
    port: config.PORT,
    host: "0.0.0.0"
  });
  app.log.info(`AgentOps backend listening on ${config.PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
