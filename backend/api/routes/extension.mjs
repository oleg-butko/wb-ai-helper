import { randomUUID } from "node:crypto";

import { ZodError } from "zod";

import { extensionReviewRequestSchema } from "../../src/shared/api/extension.mjs";
import { resolveExtensionApiKeyRequest } from "../lib/extension-auth.mjs";

const backendVersion = process.env.npm_package_version ?? "0.1.0";

function mapZodIssue(issue) {
  return {
    path: issue.path.join("."),
    message: issue.message,
  };
}

function createStubReviewResponse({ requestId, apiKeyRecord, userId, quotaRemaining }) {
  return {
    text: "Спасибо за отзыв. Мы внимательно изучим ситуацию и учтем ваши замечания в дальнейшей работе.",
    diagnostics: {
      backend: "fastify",
      backendVersion,
      mode: "stub",
      requestId,
      apiKeyId: apiKeyRecord.id,
      userId,
      quotaRemaining,
    },
  };
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

      await safeRecordExtensionGenerationEvent(request, {
        requestId,
        apiKeyId: authentication.apiKeyRecord.id,
        extensionUserId: body.user_id,
        eventType: "ai_generation_started",
        details: {
          mode: "stub",
        },
      });

      const consumedQuota = await request.server.services.consumeExtensionApiQuota({
        apiKeyId: authentication.apiKeyRecord.id,
        requestId,
        amount: 1,
        reason: "review_response_stub_succeeded",
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

      const stubResponse = createStubReviewResponse({
        requestId,
        apiKeyRecord: authentication.apiKeyRecord,
        userId: body.user_id,
        quotaRemaining: consumedQuota.quotaRemaining,
      });

      await safeRecordExtensionGenerationEvent(request, {
        requestId,
        apiKeyId: authentication.apiKeyRecord.id,
        extensionUserId: body.user_id,
        eventType: "ai_generation_succeeded",
        details: {
          mode: "stub",
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
        responsePayload: stubResponse,
        quotaConsumed: true,
      });

      return reply.send({
        ok: true,
        response: stubResponse,
      });
    } catch (error) {
      request.log.error({ err: error }, "Extension review response generation failed");

      const requestId = requestRecord?.id ?? randomUUID();
      const apiKeyId = authentication.apiKeyRecord.id;

      const errorCode =
        error?.code === "extension_user_create_failed"
          ? "extension_user_create_failed"
          : "review_response_generation_failed";

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

      if (requestRecord?.id) {
        await request.server.services.updateExtensionGenerationRequest({
          requestId: requestRecord.id,
          status: "failed",
          responsePayload: null,
          quotaConsumed: false,
        });
      }

      return reply.code(errorCode === "extension_user_create_failed" ? 500 : 502).send({
        error: errorCode,
        message:
          errorCode === "extension_user_create_failed"
            ? "The backend could not create or load the extension user."
            : "The backend could not generate a review response.",
      });
    }
  });
}
