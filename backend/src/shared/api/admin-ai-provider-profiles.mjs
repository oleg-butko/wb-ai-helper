import { z } from "zod";

export const adminAiProviderProfileSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  baseUrl: z.string(),
  defaultModel: z.string().nullable(),
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
});

export const updateAdminAiProviderProfileRequestSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  baseUrl: z.string().trim().url().max(500).optional(),
  apiKey: z.string().trim().min(1).max(4000).optional(),
  defaultModel: z.string().trim().min(1).max(200).nullable().optional(),
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
