import {
  createAdminAiPromptProfileRequestSchema,
  previewAdminAiPromptProfileRequestSchema,
  updateAdminAiPromptProfileRequestSchema,
} from "../../src/shared/api/admin-ai-prompt-profiles.mjs";
import { renderProductDetailsPrompt } from "../lib/prompt-template-renderer.mjs";
import { resolveAppAdminRequest } from "../lib/admin-auth.mjs";

function mapAdminAiPromptProfileError(error, reply) {
  if (error?.code === "admin_ai_prompt_profile_not_found") {
    return reply.code(404).send({
      error: "admin_ai_prompt_profile_not_found",
      message: "The requested AI prompt profile was not found.",
    });
  }

  if (error?.code === "admin_ai_prompt_profile_unknown_placeholders") {
    return reply.code(400).send({
      error: "admin_ai_prompt_profile_unknown_placeholders",
      message: "The product details template contains unknown placeholders.",
      details: error.details ?? {},
    });
  }

  if (error?.name === "ZodError") {
    return reply.code(400).send({
      error: "admin_ai_prompt_profile_invalid",
      message: "The AI prompt profile admin request was invalid.",
    });
  }

  return null;
}

function createPreviewResponse({ profile, payload, template }) {
  return {
    profileId: profile.id,
    systemPrompt: profile.systemPrompt,
    productDetailsPrompt: renderProductDetailsPrompt({
      template,
      payload,
    }),
    usedExamplePayload: payload,
    unknownPlaceholders: [],
  };
}

export async function registerAdminAiPromptProfileRoutes(app) {
  app.get("/v1/admin/ai-prompt-profiles", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const profiles = await request.server.services.listAdminAiPromptProfiles();
      return reply.send({ profiles });
    } catch (error) {
      request.log.error({ err: error }, "Admin AI prompt profile list failed");
      return reply.code(500).send({
        error: "admin_ai_prompt_profile_list_failed",
        message: "The backend could not list AI prompt profiles.",
      });
    }
  });

  app.post("/v1/admin/ai-prompt-profiles", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const payload = createAdminAiPromptProfileRequestSchema.parse(request.body ?? {});
      renderProductDetailsPrompt({
        template: payload.productDetailsTemplate,
        payload: payload.examplePayload,
      });
      const profile = await request.server.services.createAdminAiPromptProfile({
        ...payload,
        adminUserId: authentication.user.id,
      });

      return reply.code(201).send({ profile });
    } catch (error) {
      const handled = mapAdminAiPromptProfileError(error, reply);

      if (handled) {
        return handled;
      }

      request.log.error({ err: error }, "Admin AI prompt profile create failed");
      return reply.code(500).send({
        error: "admin_ai_prompt_profile_create_failed",
        message: "The backend could not create the AI prompt profile.",
      });
    }
  });

  app.patch("/v1/admin/ai-prompt-profiles/:profileId", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const currentProfile = await request.server.services.getAdminAiPromptProfile({
        profileId: request.params.profileId,
      });

      if (!currentProfile) {
        return reply.code(404).send({
          error: "admin_ai_prompt_profile_not_found",
          message: "The requested AI prompt profile was not found.",
        });
      }

      const payload = updateAdminAiPromptProfileRequestSchema.parse(request.body ?? {});
      renderProductDetailsPrompt({
        template: payload.productDetailsTemplate ?? currentProfile.productDetailsTemplate,
        payload: payload.examplePayload ?? currentProfile.examplePayload,
      });
      const profile = await request.server.services.updateAdminAiPromptProfile({
        profileId: request.params.profileId,
        ...payload,
        adminUserId: authentication.user.id,
      });

      return reply.send({ profile });
    } catch (error) {
      const handled = mapAdminAiPromptProfileError(error, reply);

      if (handled) {
        return handled;
      }

      request.log.error({ err: error }, "Admin AI prompt profile update failed");
      return reply.code(500).send({
        error: "admin_ai_prompt_profile_update_failed",
        message: "The backend could not update the AI prompt profile.",
      });
    }
  });

  app.post("/v1/admin/ai-prompt-profiles/:profileId/preview", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const profile = await request.server.services.getAdminAiPromptProfile({
        profileId: request.params.profileId,
      });

      if (!profile) {
        return reply.code(404).send({
          error: "admin_ai_prompt_profile_not_found",
          message: "The requested AI prompt profile was not found.",
        });
      }

      const payload = previewAdminAiPromptProfileRequestSchema.parse(request.body ?? {});
      return reply.send(createPreviewResponse({
        profile,
        payload: payload.examplePayload ?? profile.examplePayload,
        template: payload.productDetailsTemplate ?? profile.productDetailsTemplate,
      }));
    } catch (error) {
      const handled = mapAdminAiPromptProfileError(error, reply);

      if (handled) {
        return handled;
      }

      request.log.error({ err: error }, "Admin AI prompt profile preview failed");
      return reply.code(500).send({
        error: "admin_ai_prompt_profile_preview_failed",
        message: "The backend could not preview the AI prompt profile.",
      });
    }
  });

  app.post("/v1/admin/ai-prompt-profiles/:profileId/activate", async (request, reply) => {
    const authentication = await resolveAppAdminRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    try {
      const profile = await request.server.services.activateAdminAiPromptProfile({
        profileId: request.params.profileId,
        adminUserId: authentication.user.id,
      });

      return reply.send({ profile });
    } catch (error) {
      const handled = mapAdminAiPromptProfileError(error, reply);

      if (handled) {
        return handled;
      }

      request.log.error({ err: error }, "Admin AI prompt profile activate failed");
      return reply.code(500).send({
        error: "admin_ai_prompt_profile_activate_failed",
        message: "The backend could not activate the AI prompt profile.",
      });
    }
  });
}
