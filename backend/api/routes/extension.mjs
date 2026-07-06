import { randomUUID } from "node:crypto";

import { ZodError } from "zod";

import { extensionReviewRequestSchema } from "../../src/shared/api/extension.mjs";
import { resolveExtensionApiKeyRequest } from "../lib/extension-auth.mjs";
import { createOpenAiCompatibleChatCompletion } from "../lib/openai-compatible-provider.mjs";
import { renderProductDetailsPrompt } from "../lib/prompt-template-renderer.mjs";

const backendVersion = process.env.npm_package_version ?? "0.1.0";

function mapZodIssue(issue) {
  return {
    path: issue.path.join("."),
    message: issue.message,
  };
}

function createReviewResponse({
  requestId,
  apiKeyRecord,
  userId,
  quotaRemaining,
  responseText,
  providerProfile,
  promptProfile,
}) {
  return {
    text: responseText,
    diagnostics: {
      backend: "fastify",
      backendVersion,
      mode: "provider",
      requestId,
      apiKeyId: apiKeyRecord.id,
      userId,
      quotaRemaining,
      providerProfileId: providerProfile.id,
      promptProfileId: promptProfile.id,
      model: providerProfile.defaultModel,
    },
  };
}

function createConfigurationError({ code, message }) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function createPromptPreview(value, maxLength = 1_000) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
}

function getReviewResponseErrorCode(error) {
  if (error?.code === "extension_user_create_failed") {
    return "extension_user_create_failed";
  }

  if (
    error?.code === "active_ai_prompt_profile_missing" ||
    error?.code === "active_ai_provider_profile_missing" ||
    error?.code === "active_ai_provider_model_missing"
  ) {
    return error.code;
  }

  return "review_response_generation_failed";
}

async function safeRecordExtensionError(request, payload) {
  try {
    await request.server.services.recordExtensionError(payload);
  } catch (error) {
    request.log.error({ err: error }, "Extension error recording failed");
  }
}

async function safeRecordExtensionGenerationEvent(request, payload) {
  try {
    await request.server.services.recordExtensionGenerationEvent(payload);
  } catch (error) {
    request.log.error({ err: error }, "Extension generation event recording failed");
  }
}

export async function registerExtensionRoutes(app) {
  app.post("/v1/extension/api-key/check", async (request, reply) => {
    const authentication = await resolveExtensionApiKeyRequest(request, reply);

    if (!authentication.ok) {
      return authentication.response;
    }

    return reply.send({
      ok: true,
      message: "API key is valid and has remaining quota.",
      diagnostics: {
        backend: "fastify",
        backendVersion,
        apiKeyId: authentication.apiKeyRecord.id,
        quotaTotal: authentication.apiKeyRecord.quotaTotal,
        quotaUsed: authentication.apiKeyRecord.quotaUsed,
        quotaRemaining: authentication.apiKeyRecord.quotaRemaining,
      },
    });
  });

  app.post("/v1/extension/review-response", async (request, reply) => {
    let body;

    try {
      body = extensionReviewRequestSchema.parse(request.body ?? {});
    } catch (error) {
      const issues = error instanceof ZodError ? error.issues.map(mapZodIssue) : [];
      return reply.code(400).send({
        error: "invalid_extension_request",
        message: "Provide a valid extension review response request.",
        details: {
          issues,
        },
      });
    }

    const authentication = await resolveExtensionApiKeyRequest(request, reply);

    if (!authentication.ok) {
      await safeRecordExtensionError(request, {
        requestId: null,
        apiKeyId: authentication.apiKeyId,
        extensionUserId: body.user_id,
        errorCode: authentication.errorCode,
        errorMessage: authentication.errorMessage,
        errorDetails: {
          status_code: authentication.statusCode,
        },
      });

      return authentication.response;
    }

    let requestRecord = null;

    try {
      requestRecord = await request.server.services.createExtensionGenerationRequest({
        apiKeyId: authentication.apiKeyRecord.id,
        extensionUserId: body.user_id,
        requestPayload: body,
        status: "received",
      });

      const requestId = requestRecord.id ?? randomUUID();

      await safeRecordExtensionGenerationEvent(request, {
        requestId,
        apiKeyId: authentication.apiKeyRecord.id,
        extensionUserId: body.user_id,
        eventType: "request_received",
        details: {
          backend: "fastify",
          backendVersion,
        },
      });

      await safeRecordExtensionGenerationEvent(request, {
        requestId,
        apiKeyId: authentication.apiKeyRecord.id,
        extensionUserId: body.user_id,
        eventType: "api_key_validated",
        details: {
          quota_total: authentication.apiKeyRecord.quotaTotal,
          quota_used: authentication.apiKeyRecord.quotaUsed,
          quota_remaining: authentication.apiKeyRecord.quotaRemaining,
        },
      });

      const extensionUser = await request.server.services.ensureExtensionUser({
        userId: body.user_id,
        apiKey: authentication.apiKey,
        apiKeyId: authentication.apiKeyRecord.id,
      });

      await safeRecordExtensionGenerationEvent(request, {
        requestId,
        apiKeyId: authentication.apiKeyRecord.id,
        extensionUserId: body.user_id,
        eventType: extensionUser.created ? "user_created" : "user_found",
        details: {
          auth_user_id: extensionUser.id,
          email: extensionUser.email,
        },
      });

      const promptProfile = await request.server.services.getActiveAiPromptProfile();

      if (!promptProfile) {
        throw createConfigurationError({
          code: "active_ai_prompt_profile_missing",
          message: "No active AI prompt profile is configured.",
        });
      }

      const providerProfile = await request.server.services.getActiveAiProviderProfileSecret();

      if (!providerProfile) {
        throw createConfigurationError({
          code: "active_ai_provider_profile_missing",
          message: "No active AI provider profile is configured.",
        });
      }

      if (!providerProfile.defaultModel) {
        throw createConfigurationError({
          code: "active_ai_provider_model_missing",
          message: "The active AI provider profile has no default model.",
        });
      }

      const productDetailsPrompt = renderProductDetailsPrompt({
        template: promptProfile.productDetailsTemplate,
        payload: body.review,
      });

      await safeRecordExtensionGenerationEvent(request, {
        requestId,
        apiKeyId: authentication.apiKeyRecord.id,
        extensionUserId: body.user_id,
        eventType: "prompt_rendered",
        details: {
          prompt_profile_id: promptProfile.id,
          product_details_count: body.review.product_details.length,
          product_details_preview: body.review.product_details.slice(0, 10),
          rendered_prompt_preview: createPromptPreview(productDetailsPrompt),
        },
      });

      await safeRecordExtensionGenerationEvent(request, {
        requestId,
        apiKeyId: authentication.apiKeyRecord.id,
        extensionUserId: body.user_id,
        eventType: "ai_generation_started",
        details: {
          mode: "provider",
          provider_profile_id: providerProfile.id,
          prompt_profile_id: promptProfile.id,
          model: providerProfile.defaultModel,
        },
      });

      const responseText = await createOpenAiCompatibleChatCompletion({
        baseUrl: providerProfile.baseUrl,
        apiKey: providerProfile.apiKey,
        model: providerProfile.defaultModel,
        messages: [
          {
            role: "system",
            content: promptProfile.systemPrompt,
          },
          {
            role: "user",
            content: productDetailsPrompt,
          },
        ],
      });

      const consumedQuota = await request.server.services.consumeExtensionApiQuota({
        apiKeyId: authentication.apiKeyRecord.id,
        requestId,
        amount: 1,
        reason: "review_response_ai_succeeded",
      });

      if (!consumedQuota) {
        await safeRecordExtensionError(request, {
          requestId,
          apiKeyId: authentication.apiKeyRecord.id,
          extensionUserId: body.user_id,
          errorCode: "quota_consume_failed",
          errorMessage: "The backend generated a response but could not consume API key quota.",
          errorDetails: {
            quota_total: authentication.apiKeyRecord.quotaTotal,
            quota_used: authentication.apiKeyRecord.quotaUsed,
          },
        });

        return reply.code(409).send({
          error: "quota_consume_failed",
          message: "The backend could not reserve quota for this successful generation. Try again.",
        });
      }

      const reviewResponse = createReviewResponse({
        requestId,
        apiKeyRecord: authentication.apiKeyRecord,
        userId: body.user_id,
        quotaRemaining: consumedQuota.quotaRemaining,
        responseText,
        providerProfile,
        promptProfile,
      });

      await safeRecordExtensionGenerationEvent(request, {
        requestId,
        apiKeyId: authentication.apiKeyRecord.id,
        extensionUserId: body.user_id,
        eventType: "ai_generation_succeeded",
        details: {
          mode: "provider",
          provider_profile_id: providerProfile.id,
          prompt_profile_id: promptProfile.id,
          model: providerProfile.defaultModel,
          quota_remaining: consumedQuota.quotaRemaining,
        },
      });

      await safeRecordExtensionGenerationEvent(request, {
        requestId,
        apiKeyId: authentication.apiKeyRecord.id,
        extensionUserId: body.user_id,
        eventType: "quota_consumed",
        details: {
          amount: 1,
          quota_total: consumedQuota.quotaTotal,
          quota_used: consumedQuota.quotaUsed,
          quota_remaining: consumedQuota.quotaRemaining,
        },
      });

      await request.server.services.updateExtensionGenerationRequest({
        requestId,
        status: "succeeded",
        responsePayload: reviewResponse,
        quotaConsumed: true,
      });

      return reply.send({
        ok: true,
        response: reviewResponse,
      });
    } catch (error) {
      request.log.error({ err: error }, "Extension review response generation failed");

      const requestId = requestRecord?.id ?? randomUUID();
      const apiKeyId = authentication.apiKeyRecord.id;

      const errorCode = getReviewResponseErrorCode(error);

      await safeRecordExtensionError(request, {
        requestId,
        apiKeyId,
        extensionUserId: body.user_id,
        errorCode,
        errorMessage: error?.message ?? "Extension review response generation failed.",
        errorDetails: {
          name: error?.name ?? "Error",
          code: error?.code ?? null,
        },
      });

      await safeRecordExtensionGenerationEvent(request, {
        requestId,
        apiKeyId,
        extensionUserId: body.user_id,
        eventType: "ai_generation_failed",
        details: {
          error_code: errorCode,
          name: error?.name ?? "Error",
          code: error?.code ?? null,
        },
      });

      if (requestRecord?.id) {
        await request.server.services.updateExtensionGenerationRequest({
          requestId: requestRecord.id,
          status: "failed",
          responsePayload: null,
          quotaConsumed: false,
        });
      }

      const isConfigurationError = errorCode.startsWith("active_ai_");

      return reply.code(errorCode === "extension_user_create_failed" ? 500 : isConfigurationError ? 503 : 502).send({
        error: errorCode,
        message:
          errorCode === "extension_user_create_failed"
            ? "The backend could not create or load the extension user."
            : isConfigurationError
              ? error.message
            : "The backend could not generate a review response.",
      });
    }
  });
}
