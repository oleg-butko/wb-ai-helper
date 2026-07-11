import { spawn } from "node:child_process";

import { createLogSession } from "./process-logs.mjs";

const childProcesses = [];
const logSession = createLogSession({ command: "dev" });
logSession.writeSystem(`Saving dev output to ${logSession.directory}`);

function runScript(scriptName, logFileName) {
  
  const child =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/s", "/c", `npm run ${scriptName}`], {
          stdio: ["inherit", "pipe", "pipe"],
          env: logSession.env,
        })
      : spawn("npm", ["run", scriptName], {
          stdio: ["inherit", "pipe", "pipe"],
          env: logSession.env,
        });

  childProcesses.push(child);
  logSession.attachChild(child, logFileName);

  child.on("error", (error) => {
    logSession.writeSystem(`${scriptName} failed to start: ${error.message}`);
    shutdown(1);
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });
}

function shutdown(exitCode = 0) {
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

runScript("dev:api", "api.log");
runScript("dev:worker", "worker.log");
runScript("dev:web", "web.log");
