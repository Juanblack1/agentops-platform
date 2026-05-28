import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readVercelToken } from "./vercel-auth.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const token = await readVercelToken();
const child = spawn(
  process.execPath,
  [join(rootDir, "node_modules", "@vercel", "sdk", "bin", "mcp-server.js"), "start", "--bearer-token", token, ...process.argv.slice(2)],
  {
    stdio: "inherit"
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
