import { spawn } from "node:child_process";
import path from "node:path";

import { getProdIsolationWarnings, loadRuntimeEnv } from "../env-profiles.mjs";

const projectRoot = process.cwd();
const runtimeEnv = loadRuntimeEnv({ profile: "prod", projectRoot });

for (const warning of getProdIsolationWarnings({ projectRoot })) {
  console.warn(`[prod-env] ${warning}`);
}

const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    WB_AI_HELPER_ENV: runtimeEnv.profile,
    NODE_ENV: "production",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
