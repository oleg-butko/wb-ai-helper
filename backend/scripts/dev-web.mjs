import { spawn } from "node:child_process";
import path from "node:path";
import { loadEnvFiles } from "./load-env.mjs";

loadEnvFiles([".env.api.local", ".env.local"]);

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child =
  process.platform === "win32"
    ? spawn(process.execPath, [nextBin, "dev"], {
        stdio: "inherit",
        env: process.env,
      })
    : spawn(process.execPath, [nextBin, "dev"], {
        stdio: "inherit",
        env: process.env,
      });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
