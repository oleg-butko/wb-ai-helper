import { spawn } from "node:child_process";

import { getProdIsolationWarnings, loadRuntimeEnv } from "../env-profiles.mjs";
import { createLogSession } from "../process-logs.mjs";

const runtimeEnv = loadRuntimeEnv({ profile: "prod" });
const logSession = createLogSession({ command: "prod-start" });
logSession.writeSystem(`Saving prod output to ${logSession.directory}`);

for (const warning of getProdIsolationWarnings()) {
  logSession.writeLine(`[prod-env] ${warning}`, process.stderr);
}

const childProcesses = [];
let shuttingDown = false;

function runScript(scriptName, logFileName) {
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
    stdio: ["inherit", "pipe", "pipe"],
    env: {
      ...logSession.env,
      WB_AI_HELPER_ENV: runtimeEnv.profile,
      NODE_ENV: "production",
    },
  });

  childProcesses.push(child);
  logSession.attachChild(child, logFileName);

  child.on("error", (error) => {
    logSession.writeSystem(`${scriptName} failed to start: ${error.message}`);
    shutdown(1);
  });

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

  logSession.close();
  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

runScript("start:prod:api", "api.log");
runScript("start:prod:worker", "worker.log");
runScript("start:prod:web", "web.log");
