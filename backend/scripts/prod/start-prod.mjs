import { spawn } from "node:child_process";

import { getProdIsolationWarnings, loadRuntimeEnv } from "../env-profiles.mjs";

const runtimeEnv = loadRuntimeEnv({ profile: "prod" });

for (const warning of getProdIsolationWarnings()) {
  console.warn(`[prod-env] ${warning}`);
}

const childProcesses = [];
let shuttingDown = false;

function runScript(scriptName) {
  const command =
    process.platform === "win32"
      ? {
          file: "cmd.exe",
          args: ["/d", "/s", "/c", `npm run ${scriptName}`],
        }
      : {
          file: "npm",
          args: ["run", scriptName],
        };

  const child = spawn(command.file, command.args, {
    stdio: "inherit",
    env: {
      ...process.env,
      WB_AI_HELPER_ENV: runtimeEnv.profile,
      NODE_ENV: "production",
    },
  });

  childProcesses.push(child);

  child.on("exit", (code) => {
    if (!shuttingDown) {
      shutdown(code ?? 0);
    }
  });
}

function shutdown(exitCode = 0) {
  shuttingDown = true;

  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

runScript("start:prod:api");
runScript("start:prod:worker");
runScript("start:prod:web");
