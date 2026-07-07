import { spawn } from "node:child_process";
import { loadRuntimeEnv } from "./env-profiles.mjs";

loadRuntimeEnv();

const child = spawn(process.execPath, ["api/server.mjs"], {
  stdio: "inherit",
  env: process.env,
});

function shutdown(exitCode = 0) {
  if (!child.killed) {
    child.kill("SIGTERM");
  }

  process.exit(exitCode);
}

child.on("exit", (code) => {
  if (code && code !== 0) {
    shutdown(code);
  }
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
