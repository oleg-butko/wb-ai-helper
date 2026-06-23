import { z } from "zod";

export const extensionReviewRequestSchema = z.object({
  user_id: z.string().uuid(),
  review: z.record(z.string(), z.unknown()),
});

export const extensionDiagnosticsSchema = z.object({
  backend: z.literal("fastify"),
  backendVersion: z.string(),
  mode: z.literal("stub"),
  requestId: z.string().uuid(),
  apiKeyId: z.string().uuid(),
  userId: z.string().uuid(),
  quotaRemaining: z.number().int().min(0),
});

export const extensionReviewSuccessResponseSchema = z.object({
  ok: z.literal(true),
  response: z.object({
    text: z.string(),
    diagnostics: extensionDiagnosticsSchema,
  }),
});

export const extensionReviewErrorCodeSchema = z.enum([
  "api_key_required",
  "invalid_api_key",
  "api_key_invalidated",
  "api_key_quota_exhausted",
  "invalid_extension_request",
  "extension_user_create_failed",
  "quota_consume_failed",
  "review_response_generation_failed",
  "internal_api_error",
]);

export const extensionReviewErrorResponseSchema = z.object({
  error: extensionReviewErrorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const extensionReviewResponseSchema = z.union([
  extensionReviewSuccessResponseSchema,
  extensionReviewErrorResponseSchema,
]);
