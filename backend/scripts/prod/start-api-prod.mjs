import { spawn } from "node:child_process";

import { loadRuntimeEnv } from "../env-profiles.mjs";

const runtimeEnv = loadRuntimeEnv({ profile: "prod" });

const child = spawn(process.execPath, ["api/server.mjs"], {
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
