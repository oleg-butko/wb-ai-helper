import { z } from "zod";

export const adminExtensionApiKeySummarySchema = z.object({
  id: z.string().uuid(),
  label: z.string().nullable(),
  quotaTotal: z.number().int().min(0),
  quotaUsed: z.number().int().min(0),
  quotaRemaining: z.number().int().min(0),
  invalidatedAt: z.string().nullable(),
  invalidationReason: z.string().nullable().optional(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const adminExtensionQuotaEventSchema = z.object({
  id: z.string().uuid(),
  apiKeyId: z.string().uuid(),
  eventType: z.enum(["grant", "remove", "consume", "invalidate"]),
  amount: z.number().int(),
  requestId: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  createdByAdminUserId: z.string().uuid().nullable(),
  createdAt: z.string(),
});

export const adminExtensionApiKeyUserSchema = z.object({
  extensionUserId: z.string().uuid(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string().nullable(),
});

export const adminExtensionGenerationRequestSummarySchema = z.object({
  id: z.string().uuid(),
  extensionUserId: z.string().uuid(),
  status: z.enum(["received", "succeeded", "failed"]),
  quotaConsumed: z.boolean(),
  createdAt: z.string(),
});

export const adminExtensionErrorSummarySchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid().nullable(),
  extensionUserId: z.string().uuid().nullable(),
  errorCode: z.string(),
  errorMessage: z.string(),
  createdAt: z.string(),
});

export const adminExtensionApiKeyDetailSchema = z.object({
  apiKey: adminExtensionApiKeySummarySchema,
  quotaEvents: z.array(adminExtensionQuotaEventSchema),
  users: z.array(adminExtensionApiKeyUserSchema),
  requests: z.array(adminExtensionGenerationRequestSummarySchema),
  errors: z.array(adminExtensionErrorSummarySchema),
});

export const adminExtensionApiKeyListResponseSchema = z.object({
  apiKeys: z.array(adminExtensionApiKeySummarySchema),
});

export const createAdminExtensionApiKeyRequestSchema = z.object({
  label: z.string().trim().max(120).optional(),
  quota: z.number().int().min(0).max(1_000_000).default(0),
  reason: z.string().trim().max(500).optional(),
});

export const createAdminExtensionApiKeyResponseSchema = z.object({
  apiKey: adminExtensionApiKeySummarySchema,
  rawApiKey: z.string(),
});

export const findAdminExtensionApiKeyRequestSchema = z.object({
  apiKey: z.string().trim().min(1),
});

export const findAdminExtensionApiKeyResponseSchema = z.object({
  result: adminExtensionApiKeyDetailSchema.nullable(),
});

export const adminExtensionApiKeyDetailResponseSchema = z.object({
  result: adminExtensionApiKeyDetailSchema,
});

export const adjustAdminExtensionApiKeyQuotaRequestSchema = z.object({
  direction: z.enum(["grant", "remove"]),
  amount: z.number().int().min(1).max(1_000_000),
  reason: z.string().trim().max(500).optional(),
});

export const adjustAdminExtensionApiKeyQuotaResponseSchema = z.object({
  apiKey: adminExtensionApiKeySummarySchema,
});

export const invalidateAdminExtensionApiKeyRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const invalidateAdminExtensionApiKeyResponseSchema = z.object({
  apiKey: adminExtensionApiKeySummarySchema,
});

export const adminExtensionApiKeyErrorCodeSchema = z.enum([
  "authorization_required",
  "invalid_session",
  "app_admin_required",
  "admin_extension_api_key_not_found",
  "admin_extension_api_key_invalid",
  "admin_extension_api_key_create_failed",
  "admin_extension_api_key_update_failed",
  "admin_extension_api_key_list_failed",
  "internal_api_error",
]);

export const adminExtensionApiKeyErrorResponseSchema = z.object({
  error: adminExtensionApiKeyErrorCodeSchema,
  message: z.string(),
});
