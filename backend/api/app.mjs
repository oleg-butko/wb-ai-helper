import Fastify from "fastify";
import multipart from "@fastify/multipart";

import { registerApiModuleRoutes } from "./modules/registry.mjs";
import { registerApiServicesPlugin } from "./plugins/services.mjs";
import { registerAccountRoutes } from "./routes/account.mjs";
import { registerAdminAiProviderProfileRoutes } from "./routes/admin-ai-provider-profiles.mjs";
import { registerAdminExtensionApiKeyRoutes } from "./routes/admin-extension-api-keys.mjs";
import { registerAdminWorkspaceRoutes } from "./routes/admin-workspaces.mjs";
import { registerExtensionRoutes } from "./routes/extension.mjs";
import { registerHealthRoutes } from "./routes/health.mjs";
import { registerWorkspaceRoutes } from "./routes/workspaces.mjs";

export function buildApiApp({ services }) {
  const app = Fastify({
    logger: {
      base: null,
      formatters: {
        level(label) {
          return { level: label };
        },
        log(object) {
          if (typeof object.responseTime === "number") {
            return {
              ...object,
              responseTime: Number(object.responseTime.toFixed(2)),
            };
          }

          return object;
        },
      },
    },
  });

  registerApiServicesPlugin(app, services);
  app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 10 * 1024 * 1024,
    },
  });

  app.register(registerHealthRoutes);
  app.register(registerAccountRoutes);
  app.register(registerAdminAiProviderProfileRoutes);
  app.register(registerAdminExtensionApiKeyRoutes);
  app.register(registerAdminWorkspaceRoutes);
  app.register(registerExtensionRoutes);
  app.register(registerWorkspaceRoutes);
  registerApiModuleRoutes(app);

  return app;
}
