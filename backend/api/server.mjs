import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadRuntimeEnv } from "../scripts/env-profiles.mjs";
import { buildApiApp } from "./app.mjs";
import { assertApiEnv, getApiConfig } from "./config.mjs";
import { createBullMQQueueTransport, hasBullMQConfig } from "./core/queue/bullmq.mjs";
import { createQueueService } from "./core/queue/service.mjs";
import { createStorageService } from "./services/storage.mjs";
import { createApiServices } from "./supabase.mjs";

const apiDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(apiDir, "..");

const runtimeEnv = loadRuntimeEnv({ projectRoot });

const config = assertApiEnv(getApiConfig());
const queueTransport = hasBullMQConfig(config)
  ? createBullMQQueueTransport(config)
  : undefined;
const queueService = createQueueService({
  transport: queueTransport,
});
const app = buildApiApp({
  services: {
    ...createApiServices(config),
    ...queueService,
    ...createStorageService(config),
  },
});

async function start() {
  try {
    app.log.info(
      {
        envProfile: runtimeEnv.profile,
        envFiles: runtimeEnv.envFiles.map((file) => file.relativePath),
      },
      "Runtime env profile loaded",
    );

    if (config.storageS3EnsureBucketOnStart) {
      await app.services.ensureBucketExists();
      app.log.info(
        { bucket: app.services.getBucketName() },
        "Storage bucket preflight completed",
      );
    }

    await app.listen({
      host: "127.0.0.1",
      port: config.port,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  await queueService.closeQueue();
  await app.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await queueService.closeQueue();
  await app.close();
  process.exit(0);
});

start();
