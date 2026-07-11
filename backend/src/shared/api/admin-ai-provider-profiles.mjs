import { z } from "zod";

export const aiProviderRoutingSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("default") }),
  z.object({
    mode: z.literal("fallback"),
    order: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
  }),
  z.object({
    mode: z.literal("only-one"),
    only: z.string().trim().min(1).max(200),
  }),
]);

const temperatureSchema = z.number().min(0).max(2);
const maxTokensSchema = z.number().int().min(1).max(1_000_000);

export const adminAiProviderProfileSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  baseUrl: z.string(),
  defaultModel: z.string().nullable(),
  temperature: temperatureSchema,
  maxTokens: maxTokensSchema,
  providerRouting: aiProviderRoutingSchema,
  isActive: z.boolean(),
  hasApiKey: z.boolean(),
  apiKeyPreview: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const adminAiProviderProfileListResponseSchema = z.object({
  profiles: z.array(adminAiProviderProfileSchema),
});

export const createAdminAiProviderProfileRequestSchema = z.object({
  label: z.string().trim().min(1).max(120),
  baseUrl: z.string().trim().url().max(500),
  apiKey: z.string().trim().min(1).max(4000),
  defaultModel: z.string().trim().min(1).max(200).optional(),
  temperature: temperatureSchema.default(1),
  maxTokens: maxTokensSchema.default(500),
  providerRouting: aiProviderRoutingSchema.default({ mode: "default" }),
});

export const updateAdminAiProviderProfileRequestSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  baseUrl: z.string().trim().url().max(500).optional(),
  apiKey: z.string().trim().min(1).max(4000).optional(),
  defaultModel: z.string().trim().min(1).max(200).nullable().optional(),
  temperature: temperatureSchema.optional(),
  maxTokens: maxTokensSchema.optional(),
  providerRouting: aiProviderRoutingSchema.optional(),
});

export const createAdminAiProviderProfileResponseSchema = z.object({
  profile: adminAiProviderProfileSchema,
});

export const updateAdminAiProviderProfileResponseSchema = z.object({
  profile: adminAiProviderProfileSchema,
});

export const activateAdminAiProviderProfileResponseSchema = z.object({
  profile: adminAiProviderProfileSchema,
});

export const adminAiProviderModelSchema = z.object({
  id: z.string(),
});

export const adminAiProviderProfileModelsResponseSchema = z.object({
  models: z.array(adminAiProviderModelSchema),
});

export const adminAiProviderProfileCheckResponseSchema = z.object({
  ok: z.literal(true),
  model: z.string(),
  responseText: z.string(),
});

export const adminAiProviderProfileErrorCodeSchema = z.enum([
  "authorization_required",
  "invalid_session",
  "app_admin_required",
  "admin_ai_provider_profile_not_found",
  "admin_ai_provider_profile_invalid",
  "admin_ai_provider_profile_create_failed",
  "admin_ai_provider_profile_update_failed",
  "admin_ai_provider_profile_activate_failed",
  "admin_ai_provider_profile_list_failed",
  "admin_ai_provider_profile_models_failed",
  "admin_ai_provider_profile_check_failed",
  "internal_api_error",
]);

export const adminAiProviderProfileErrorResponseSchema = z.object({
  error: adminAiProviderProfileErrorCodeSchema,
  message: z.string(),
});
