import { z } from "zod";

export const extensionParsedReviewSchema = z.object({
  name: z.string(),
  product_details: z.array(z.string()),
  feedback_reasons: z.array(z.string()),
  rating: z.number().int().min(0).max(5),
  product_name: z.string(),
  product_url: z.string(),
  vendor_code_1: z.string(),
  vendor_code_2: z.string(),
  colors: z.string().optional().default(""),
  size: z.string().optional().default(""),
});

export const extensionReviewRequestSchema = z.object({
  user_id: z.string().uuid(),
  review: extensionParsedReviewSchema,
});

export const extensionDiagnosticsSchema = z.object({
  backend: z.literal("fastify"),
  backendVersion: z.string(),
  mode: z.enum(["stub", "provider"]),
  requestId: z.string().uuid(),
  apiKeyId: z.string().uuid(),
  userId: z.string().uuid(),
  quotaRemaining: z.number().int().min(0),
  providerProfileId: z.string().uuid().optional(),
  promptProfileId: z.string().uuid().optional(),
  model: z.string().optional(),
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
  "active_ai_provider_profile_missing",
  "active_ai_provider_model_missing",
  "active_ai_prompt_profile_missing",
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
