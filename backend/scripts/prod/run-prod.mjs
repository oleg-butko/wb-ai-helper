import { spawn } from "node:child_process";
import path from "node:path";

import { loadRuntimeEnv } from "../env-profiles.mjs";
import { createLogSession } from "../process-logs.mjs";

const projectRoot = process.cwd();
const runtimeEnv = loadRuntimeEnv({ profile: "prod", projectRoot });
const logSession = createLogSession({ command: "prod", projectRoot });
const childEnv = {
  ...logSession.env,
  WB_AI_HELPER_ENV: runtimeEnv.profile,
  NODE_ENV: "production",
};
let child;
let shuttingDown = false;

logSession.writeSystem(`Saving prod output to ${logSession.directory}`);

function runNodeScript(relativeScriptPath, { logFileName, inheritOutput = false } = {}) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [path.join(projectRoot, relativeScriptPath)], {
      stdio: inheritOutput ? "inherit" : ["inherit", "pipe", "pipe"],
      env: childEnv,
    });

    if (!inheritOutput) {
      logSession.attachChild(child, logFileName);
    }

    child.once("error", reject);
    child.once("close", (code, signal) => {
      child = undefined;

      if (signal && !shuttingDown) {
        reject(new Error(`${relativeScriptPath} exited from signal ${signal}.`));
        return;
      }

      resolve(code ?? (shuttingDown ? 0 : 1));
    });
  });
}

function shutdown(signal = "SIGTERM") {
  shuttingDown = true;

  if (child && !child.killed) {
    child.kill(signal);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  const buildExitCode = await runNodeScript("scripts/prod/build-prod.mjs", {
    logFileName: "build.log",
  });

  if (buildExitCode !== 0 || shuttingDown) {
    process.exitCode = buildExitCode;
  } else {
    process.exitCode = await runNodeScript("scripts/prod/start-prod.mjs", {
      inheritOutput: true,
    });
  }
} catch (error) {
  logSession.writeSystem(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  logSession.close();
}
