import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runCase } from "./helpers/test-helpers.mjs";

import { getApiConfig } from "../config.mjs";
import { getStorageConfig } from "../services/storage.mjs";
import { readEnvFile } from "../../scripts/load-env.mjs";
import { resolveRuntimeEnvFiles, runtimeEnvProfiles } from "../../scripts/env-profiles.mjs";

await runCase("runtime env profiles resolve dev e2e and prod env files", async () => {
  assert.deepEqual(runtimeEnvProfiles.dev, [".env.api.local", ".env.local"]);
  assert.deepEqual(runtimeEnvProfiles.e2e, [".env.api.e2e.local", ".env.e2e.local"]);
  assert.deepEqual(runtimeEnvProfiles.prod, [".env.api.prod.local", ".env.prod.local"]);

  assert.deepEqual(
    resolveRuntimeEnvFiles({ profile: "prod" }).envFiles.map((file) => file.relativePath),
    [".env.api.prod.local", ".env.prod.local"],
  );
});

await runCase("api/server.mjs resolves storage env from .env.api.local", async () => {
  const envFile = readEnvFile(".env.api.local");
  const originalEnv = {
    STORAGE_S3_ENDPOINT: process.env.STORAGE_S3_ENDPOINT,
    STORAGE_S3_REGION: process.env.STORAGE_S3_REGION,
    STORAGE_S3_BUCKET: process.env.STORAGE_S3_BUCKET,
    STORAGE_S3_ACCESS_KEY_ID: process.env.STORAGE_S3_ACCESS_KEY_ID,
    STORAGE_S3_SECRET_ACCESS_KEY: process.env.STORAGE_S3_SECRET_ACCESS_KEY,
    STORAGE_S3_FORCE_PATH_STYLE: process.env.STORAGE_S3_FORCE_PATH_STYLE,
    STORAGE_S3_PUBLIC_BASE_URL: process.env.STORAGE_S3_PUBLIC_BASE_URL,
  };

  try {
    process.env.STORAGE_S3_ENDPOINT = envFile.STORAGE_S3_ENDPOINT ?? "";
    process.env.STORAGE_S3_REGION = envFile.STORAGE_S3_REGION ?? "";
    process.env.STORAGE_S3_BUCKET = envFile.STORAGE_S3_BUCKET ?? "";
    process.env.STORAGE_S3_ACCESS_KEY_ID = envFile.STORAGE_S3_ACCESS_KEY_ID ?? "";
    process.env.STORAGE_S3_SECRET_ACCESS_KEY = envFile.STORAGE_S3_SECRET_ACCESS_KEY ?? "";
    process.env.STORAGE_S3_FORCE_PATH_STYLE = envFile.STORAGE_S3_FORCE_PATH_STYLE ?? "";
    process.env.STORAGE_S3_PUBLIC_BASE_URL = envFile.STORAGE_S3_PUBLIC_BASE_URL ?? "";

    const config = getApiConfig();
    const storage = getStorageConfig(config);

    assert.ok(storage.storageS3Endpoint);
    assert.ok(storage.storageS3Region);
    assert.ok(storage.storageS3Bucket);
    assert.ok(storage.storageS3AccessKeyId);
    assert.ok(storage.storageS3SecretAccessKey);
    assert.equal(storage.storageS3Endpoint, (envFile.STORAGE_S3_ENDPOINT ?? "").replace(/\/+$/, ""));
    assert.equal(storage.storageS3Region, envFile.STORAGE_S3_REGION ?? "");
    assert.equal(storage.storageS3Bucket, envFile.STORAGE_S3_BUCKET ?? "");
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

await runCase("dev:web loads server-only API env before next dev", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  );
  const devWebSource = await readFile(
    new URL("../../scripts/dev-web.mjs", import.meta.url),
    "utf8",
  );

  assert.equal(packageJson.scripts["dev:web"], "node scripts/dev-web.mjs");
  assert.match(devWebSource, /loadRuntimeEnv\(\)/);
  assert.match(devWebSource, /nextBin/);
  assert.match(devWebSource, /process\.execPath, \[nextBin, "dev"\]/);
});

await runCase("api and worker startup use runtime env profiles", async () => {
  const serverSource = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const workerSource = await readFile(new URL("../worker.mjs", import.meta.url), "utf8");
  const loadE2ESource = await readFile(
    new URL("../../scripts/load-e2e-env.mjs", import.meta.url),
    "utf8",
  );

  assert.match(serverSource, /loadRuntimeEnv\(\{ projectRoot \}\)/);
  assert.match(workerSource, /loadRuntimeEnv\(\{ projectRoot \}\)/);
  assert.doesNotMatch(serverSource, /\.env\.api\.local/);
  assert.doesNotMatch(workerSource, /\.env\.api\.local/);
  assert.match(loadE2ESource, /WB_AI_HELPER_ENV = "e2e"/);
});

await runCase("prod folder scripts load prod profile and preserve env files", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  );
  const updateProdFolderSource = await readFile(
    new URL("../../scripts/prod/update-prod-folder.mjs", import.meta.url),
    "utf8",
  );
  const buildProdSource = await readFile(
    new URL("../../scripts/prod/build-prod.mjs", import.meta.url),
    "utf8",
  );
  const runProdSource = await readFile(
    new URL("../../scripts/prod/run-prod.mjs", import.meta.url),
    "utf8",
  );

  assert.equal(packageJson.scripts["build:prod"], "node scripts/prod/build-prod.mjs");
  assert.equal(packageJson.scripts.prod, "node scripts/prod/run-prod.mjs");
  assert.equal(packageJson.scripts["start:prod"], "node scripts/prod/start-prod.mjs");
  assert.equal(packageJson.scripts["prod:update-folder"], "node scripts/prod/update-prod-folder.mjs");
  assert.match(updateProdFolderSource, /wb-ai-helper-backend-prod/);
  assert.match(updateProdFolderSource, /overwriteEnv/);
  assert.match(updateProdFolderSource, /API_PORT", "8281"/);
  assert.match(updateProdFolderSource, /PORT", "3001"/);
  assert.match(updateProdFolderSource, /STORAGE_S3_BUCKET/);
  assert.match(updateProdFolderSource, /npm ci/);
  assert.match(updateProdFolderSource, /build:prod/);
  assert.match(updateProdFolderSource, /"logs"/);
  assert.match(buildProdSource, /loadRuntimeEnv\(\{ profile: "prod", projectRoot \}\)/);
  assert.match(runProdSource, /createLogSession\(\{ command: "prod", projectRoot \}\)/);
  assert.match(runProdSource, /logFileName: "build\.log"/);
});
