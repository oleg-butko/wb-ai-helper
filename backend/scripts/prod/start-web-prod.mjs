import { spawn } from "node:child_process";
import path from "node:path";

import { loadRuntimeEnv } from "../env-profiles.mjs";

const projectRoot = process.cwd();
const runtimeEnv = loadRuntimeEnv({ profile: "prod", projectRoot });
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextBin, "start"], {
  stdio: "inherit",
  env: {
    ...process.env,
    WB_AI_HELPER_ENV: runtimeEnv.profile,
    NODE_ENV: "production",
  },
});

function shutdown(exitCode = 0) {
  if (!child.killed) {
    child.kill("SIGTERM");
  }

  process.exit(exitCode);
}

child.on("exit", (code) => {
  shutdown(code ?? 0);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
