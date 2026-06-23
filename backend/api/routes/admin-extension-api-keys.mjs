import {
  adjustAdminExtensionApiKeyQuotaRequestSchema,
  createAdminExtensionApiKeyRequestSchema,
  findAdminExtensionApiKeyRequestSchema,
  invalidateAdminExtensionApiKeyRequestSchema,
} from "../../src/shared/api/admin-extension-api-keys.mjs";
import { resolveAppAdminRequest } from "../lib/admin-auth.mjs";

function mapAdminExtensionApiKeyError(error, reply) {
  if (error?.code === "admin_extension_api_key_not_found") {
    return reply.code(404).send({
      error: "admin_extension_api_key_not_found",
      message: "The requested extension API key was not found.",
    });
  }

  if (error?.name === "ZodError") {
    return reply.code(400).send({
      error: "admin_extension_api_key_invalid",
      message: "The extension API key admin request was invalid.",
    });
  }

  return null;
}

export async function registerAdminExtensionApiKeyRoutes(app) {
  app.get("/v1/admin/extension-api-keys", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const limit = request.query?.limit === undefined ? undefined : Number(request.query.limit);
      const apiKeys = await request.server.services.listAdminExtensionApiKeys({ limit });
      return reply.send({ apiKeys });
    } catch (error) {
      request.log.error({ err: error }, "Admin extension API key list failed");
      return reply.code(500).send({
        error: "admin_extension_api_key_list_failed",
        message: "The backend could not list extension API keys.",
      });
    }
  });

  app.post("/v1/admin/extension-api-keys", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const payload = createAdminExtensionApiKeyRequestSchema.parse(request.body ?? {});
      const result = await request.server.services.createAdminExtensionApiKey({
        label: payload.label ?? null,
        quota: payload.quota,
        reason: payload.reason ?? null,
        adminUserId: authentication.user.id,
      });

      return reply.code(201).send(result);
    } catch (error) {
      const handled = mapAdminExtensionApiKeyError(error, reply);

      if (handled) {
        return handled;
      }

      request.log.error({ err: error }, "Admin extension API key create failed");
      return reply.code(500).send({
        error: "admin_extension_api_key_create_failed",
        message: "The backend could not create the extension API key.",
      });
    }
  });

  app.post("/v1/admin/extension-api-keys/find", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const payload = findAdminExtensionApiKeyRequestSchema.parse(request.body ?? {});
      const result = await request.server.services.findExtensionApiKeyByValue({
        apiKey: payload.apiKey,
      });
      return reply.send({ result });
    } catch (error) {
      const handled = mapAdminExtensionApiKeyError(error, reply);

      if (handled) {
        return handled;
      }

      request.log.error({ err: error }, "Admin extension API key lookup failed");
      return reply.code(500).send({
        error: "admin_extension_api_key_list_failed",
        message: "The backend could not look up the extension API key.",
      });
    }
  });

  app.get("/v1/admin/extension-api-keys/:apiKeyId", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const result = await request.server.services.getAdminExtensionApiKeyDetail({
        apiKeyId: request.params.apiKeyId,
      });

      if (!result) {
        return reply.code(404).send({
          error: "admin_extension_api_key_not_found",
          message: "The requested extension API key was not found.",
        });
      }

      return reply.send({ result });
    } catch (error) {
      const handled = mapAdminExtensionApiKeyError(error, reply);

      if (handled) {
        return handled;
      }

      request.log.error({ err: error }, "Admin extension API key detail failed");
      return reply.code(500).send({
        error: "admin_extension_api_key_list_failed",
        message: "The backend could not load extension API key details.",
      });
    }
  });

  app.post("/v1/admin/extension-api-keys/:apiKeyId/quota-events", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const payload = adjustAdminExtensionApiKeyQuotaRequestSchema.parse(request.body ?? {});
      const apiKey = await request.server.services.adjustAdminExtensionApiKeyQuota({
        apiKeyId: request.params.apiKeyId,
        direction: payload.direction,
        amount: payload.amount,
        reason: payload.reason ?? null,
        adminUserId: authentication.user.id,
      });

      return reply.send({ apiKey });
    } catch (error) {
      const handled = mapAdminExtensionApiKeyError(error, reply);

      if (handled) {
        return handled;
      }

      request.log.error({ err: error }, "Admin extension API key quota update failed");
      return reply.code(500).send({
        error: "admin_extension_api_key_update_failed",
        message: "The backend could not update extension API key quota.",
      });
    }
  });

  app.post("/v1/admin/extension-api-keys/:apiKeyId/invalidate", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const payload = invalidateAdminExtensionApiKeyRequestSchema.parse(request.body ?? {});
      const apiKey = await request.server.services.invalidateAdminExtensionApiKey({
        apiKeyId: request.params.apiKeyId,
        reason: payload.reason ?? null,
        adminUserId: authentication.user.id,
      });

      return reply.send({ apiKey });
    } catch (error) {
      const handled = mapAdminExtensionApiKeyError(error, reply);

      if (handled) {
        return handled;
      }

      request.log.error({ err: error }, "Admin extension API key invalidation failed");
      return reply.code(500).send({
        error: "admin_extension_api_key_update_failed",
        message: "The backend could not invalidate the extension API key.",
      });
    }
  });
}
