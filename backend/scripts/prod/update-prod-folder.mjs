import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getProdIsolationWarnings } from "../env-profiles.mjs";

const sourceRoot = process.cwd();
const targetRoot = path.join(os.homedir(), "wb-ai-helper-backend-prod");
const argv = process.argv.slice(2);
const args = new Set(argv);
const overwriteEnv = args.has("--overwrite-env");
const skipInstall = args.has("--skip-install");
const skipBuild = args.has("--skip-build");

const excludedNames = new Set([
  ".git",
  ".next",
  ".playwright",
  "_files",
  "coverage",
  "node_modules",
  "screenshots",
  "test-results",
]);

function isExcluded(relativePath) {
  const basename = path.basename(relativePath);

  return (
    excludedNames.has(basename) ||
    basename.startsWith(".env") ||
    basename.endsWith(".tsbuildinfo") ||
    basename === "next-env.d.ts"
  );
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function syncDirectory(sourceDir, targetDir, relativeDir = "") {
  await mkdir(targetDir, { recursive: true });

  const sourceEntries = new Map();

  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name);

    if (isExcluded(relativePath)) {
      continue;
    }

    sourceEntries.set(entry.name, entry);
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await syncDirectory(sourcePath, targetPath, relativePath);
      continue;
    }

    if (entry.isFile()) {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }
  }

  for (const targetEntry of await readdir(targetDir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, targetEntry.name);

    if (isExcluded(relativePath) || sourceEntries.has(targetEntry.name)) {
      continue;
    }

    await rm(path.join(targetDir, targetEntry.name), { recursive: true, force: true });
  }
}

function setEnvValue(content, key, value) {
  const lines = content.split(/\r?\n/);
  const matcher = new RegExp(`^\\s*${key}\\s*=`);
  let replaced = false;

  const nextLines = lines.map((line) => {
    if (!line.trim().startsWith("#") && matcher.test(line)) {
      replaced = true;
      return `${key}=${value}`;
    }

    return line;
  });

  if (!replaced) {
    const hasTrailingBlank = nextLines[nextLines.length - 1] === "";
    nextLines.splice(hasTrailingBlank ? nextLines.length - 1 : nextLines.length, 0, `${key}=${value}`);
  }

  return nextLines.join("\n");
}

function rewriteStorageBucket(bucket) {
  if (!bucket) {
    return bucket;
  }

  if (bucket.endsWith("-dev")) {
    return `${bucket.slice(0, -"-dev".length)}-prod`;
  }

  if (bucket.endsWith("-prod")) {
    return bucket;
  }

  return `${bucket}-prod`;
}

function isLocalLikeHostname(hostname) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.startsWith("127.") ||
    hostname === "0.0.0.0"
  );
}

function rewriteSiteUrl(siteUrl) {
  if (!siteUrl) {
    return siteUrl;
  }

  try {
    const url = new URL(siteUrl);

    if (!isLocalLikeHostname(url.hostname)) {
      return siteUrl;
    }

    url.port = "3001";

    if (url.pathname === "/" && !url.search && !url.hash) {
      return url.toString().replace(/\/$/, "");
    }

    return url.toString();
  } catch {
    return siteUrl;
  }
}

function readEnvValue(content, key) {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    if (line.slice(0, separatorIndex).trim() === key) {
      return line.slice(separatorIndex + 1).trim();
    }
  }

  return undefined;
}

async function createEnvFile({
  sourceFile,
  targetFile,
  transform,
}) {
  if (!existsSync(sourceFile)) {
    throw new Error(`Source env file is missing: ${path.relative(sourceRoot, sourceFile)}`);
  }

  const existedBefore = existsSync(targetFile);

  if (!overwriteEnv && existedBefore) {
    return "preserved";
  }

  const sourceContent = await readFile(sourceFile, "utf8");
  await writeFile(targetFile, transform(sourceContent));
  return existedBefore ? "overwritten" : "created";
}

async function runCommand(scriptName) {
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

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(command.file, command.args, {
      cwd: targetRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        WB_AI_HELPER_ENV: "prod",
        NODE_ENV: scriptName === "build:prod" ? "production" : process.env.NODE_ENV,
      },
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      resolve(code ?? 1);
    });
  });

  if (exitCode !== 0) {
    throw new Error(`npm run ${scriptName} failed with exit code ${exitCode}.`);
  }
}

async function runNpmCi() {
  const command =
    process.platform === "win32"
      ? {
          file: "cmd.exe",
          args: ["/d", "/s", "/c", "npm ci"],
        }
      : {
          file: "npm",
          args: ["ci"],
        };

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(command.file, command.args, {
      cwd: targetRoot,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      resolve(code ?? 1);
    });
  });

  if (exitCode !== 0) {
    throw new Error(`npm ci failed with exit code ${exitCode}.`);
  }
}

await mkdir(targetRoot, { recursive: true });
await syncDirectory(sourceRoot, targetRoot);

const apiEnvStatus = await createEnvFile({
  sourceFile: path.join(sourceRoot, ".env.api.local"),
  targetFile: path.join(targetRoot, ".env.api.prod.local"),
  transform(content) {
    let nextContent = setEnvValue(content, "API_PORT", "8281");
    const storageBucket = readEnvValue(nextContent, "STORAGE_S3_BUCKET");

    if (storageBucket) {
      nextContent = setEnvValue(nextContent, "STORAGE_S3_BUCKET", rewriteStorageBucket(storageBucket));
    }

    return nextContent;
  },
});

const webEnvStatus = await createEnvFile({
  sourceFile: path.join(sourceRoot, ".env.local"),
  targetFile: path.join(targetRoot, ".env.prod.local"),
  transform(content) {
    let nextContent = setEnvValue(content, "API_PORT", "8281");
    nextContent = setEnvValue(nextContent, "PORT", "3001");

    const siteUrl = readEnvValue(nextContent, "NEXT_PUBLIC_SITE_URL");

    if (siteUrl) {
      nextContent = setEnvValue(nextContent, "NEXT_PUBLIC_SITE_URL", rewriteSiteUrl(siteUrl));
    }

    return nextContent;
  },
});

console.info("Prod folder synchronized", {
  target: targetRoot,
  apiEnv: apiEnvStatus,
  webEnv: webEnvStatus,
});

for (const warning of getProdIsolationWarnings({ projectRoot: targetRoot })) {
  console.warn(`[prod-env] ${warning}`);
}

if (!skipInstall) {
  await runNpmCi();
}

if (!skipBuild) {
  await runCommand("build:prod");
}

console.info("");
console.info("Prod-like backend folder is ready.");
console.info(`Start command: cd ${targetRoot} && npm run start:prod`);
console.info(`Rebuild and start command: cd ${targetRoot} && npm run prod`);
