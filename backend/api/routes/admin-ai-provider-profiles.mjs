import {
  createAdminAiProviderProfileRequestSchema,
  updateAdminAiProviderProfileRequestSchema,
} from "../../src/shared/api/admin-ai-provider-profiles.mjs";
import {
  checkOpenAiCompatibleChat,
  listOpenAiCompatibleModels,
} from "../lib/openai-compatible-provider.mjs";
import { resolveAppAdminRequest } from "../lib/admin-auth.mjs";

function mapAdminAiProviderProfileError(error, reply) {
  if (error?.code === "admin_ai_provider_profile_not_found") {
    return reply.code(404).send({
      error: "admin_ai_provider_profile_not_found",
      message: "The requested AI provider profile was not found.",
    });
  }

  if (error?.name === "ZodError") {
    return reply.code(400).send({
      error: "admin_ai_provider_profile_invalid",
      message: "The AI provider profile admin request was invalid.",
    });
  }

  return null;
}

export async function registerAdminAiProviderProfileRoutes(app) {
  app.get("/v1/admin/ai-provider-profiles", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const profiles = await request.server.services.listAdminAiProviderProfiles();
      return reply.send({ profiles });
    } catch (error) {
      request.log.error({ err: error }, "Admin AI provider profile list failed");
      return reply.code(500).send({
        error: "admin_ai_provider_profile_list_failed",
        message: "The backend could not list AI provider profiles.",
      });
    }
  });

  app.post("/v1/admin/ai-provider-profiles", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const payload = createAdminAiProviderProfileRequestSchema.parse(request.body ?? {});
      const profile = await request.server.services.createAdminAiProviderProfile({
        ...payload,
        defaultModel: payload.defaultModel ?? null,
        adminUserId: authentication.user.id,
      });

      return reply.code(201).send({ profile });
    } catch (error) {
      const handled = mapAdminAiProviderProfileError(error, reply);

      if (handled) {
        return handled;
      }

      request.log.error({ err: error }, "Admin AI provider profile create failed");
      return reply.code(500).send({
        error: "admin_ai_provider_profile_create_failed",
        message: "The backend could not create the AI provider profile.",
      });
    }
  });

  app.patch("/v1/admin/ai-provider-profiles/:profileId", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const payload = updateAdminAiProviderProfileRequestSchema.parse(request.body ?? {});
      const profile = await request.server.services.updateAdminAiProviderProfile({
        profileId: request.params.profileId,
        ...payload,
      });

      return reply.send({ profile });
    } catch (error) {
      const handled = mapAdminAiProviderProfileError(error, reply);

      if (handled) {
        return handled;
      }

      request.log.error({ err: error }, "Admin AI provider profile update failed");
      return reply.code(500).send({
        error: "admin_ai_provider_profile_update_failed",
        message: "The backend could not update the AI provider profile.",
      });
    }
  });

  app.post("/v1/admin/ai-provider-profiles/:profileId/activate", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const profile = await request.server.services.activateAdminAiProviderProfile({
        profileId: request.params.profileId,
        adminUserId: authentication.user.id,
      });

      return reply.send({ profile });
    } catch (error) {
      const handled = mapAdminAiProviderProfileError(error, reply);

      if (handled) {
        return handled;
      }

      request.log.error({ err: error }, "Admin AI provider profile activate failed");
      return reply.code(500).send({
        error: "admin_ai_provider_profile_activate_failed",
        message: "The backend could not activate the AI provider profile.",
      });
    }
  });

  app.get("/v1/admin/ai-provider-profiles/:profileId/models", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const profile = await request.server.services.getAdminAiProviderProfileSecret({
        profileId: request.params.profileId,
      });

      if (!profile) {
        return reply.code(404).send({
          error: "admin_ai_provider_profile_not_found",
          message: "The requested AI provider profile was not found.",
        });
      }

      const models = await listOpenAiCompatibleModels({
        baseUrl: profile.baseUrl,
        apiKey: profile.apiKey,
        logContext: {
          providerProfileId: profile.id,
          correlationId: request.id,
          onError: (logError) => request.log.warn({ err: logError }, "Provider JSON log write failed"),
        },
      });

      return reply.send({ models });
    } catch (error) {
      const handled = mapAdminAiProviderProfileError(error, reply);

      if (handled) {
        return handled;
      }

      request.log.error({ err: error }, "Admin AI provider profile model list failed");
      return reply.code(502).send({
        error: "admin_ai_provider_profile_models_failed",
        message: error instanceof Error ? error.message : "The backend could not list provider models.",
      });
    }
  });

  app.post("/v1/admin/ai-provider-profiles/:profileId/check", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const profile = await request.server.services.getAdminAiProviderProfileSecret({
        profileId: request.params.profileId,
      });

      if (!profile) {
        return reply.code(404).send({
          error: "admin_ai_provider_profile_not_found",
          message: "The requested AI provider profile was not found.",
        });
      }

      const model = request.body?.model ?? profile.defaultModel;

      if (typeof model !== "string" || !model.trim()) {
        return reply.code(400).send({
          error: "admin_ai_provider_profile_invalid",
          message: "Choose a model before checking the provider profile.",
        });
      }

      const responseText = await checkOpenAiCompatibleChat({
        baseUrl: profile.baseUrl,
        apiKey: profile.apiKey,
        model: model.trim(),
        temperature: profile.temperature,
        maxTokens: profile.maxTokens,
        providerRouting: profile.providerRouting,
        logContext: {
          providerProfileId: profile.id,
          correlationId: request.id,
          onError: (logError) => request.log.warn({ err: logError }, "Provider JSON log write failed"),
        },
      });

      return reply.send({
        ok: true,
        model: model.trim(),
        responseText,
      });
    } catch (error) {
      const handled = mapAdminAiProviderProfileError(error, reply);

      if (handled) {
        return handled;
      }

      request.log.error({ err: error }, "Admin AI provider profile check failed");
      return reply.code(502).send({
        error: "admin_ai_provider_profile_check_failed",
        message: error instanceof Error ? error.message : "The backend could not check the provider profile.",
      });
    }
  });
}
