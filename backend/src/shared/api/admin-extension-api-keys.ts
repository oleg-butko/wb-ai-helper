export * from "./admin-extension-api-keys.mjs";

import type { z } from "zod";

import {
  adminExtensionApiKeyDetailResponseSchema,
  adminExtensionApiKeyErrorCodeSchema,
  adminExtensionApiKeyListResponseSchema,
  adjustAdminExtensionApiKeyQuotaRequestSchema,
  adjustAdminExtensionApiKeyQuotaResponseSchema,
  createAdminExtensionApiKeyRequestSchema,
  createAdminExtensionApiKeyResponseSchema,
  findAdminExtensionApiKeyRequestSchema,
  findAdminExtensionApiKeyResponseSchema,
  invalidateAdminExtensionApiKeyRequestSchema,
  invalidateAdminExtensionApiKeyResponseSchema,
} from "./admin-extension-api-keys.mjs";

export type AdminExtensionApiKeyListResponse = z.infer<typeof adminExtensionApiKeyListResponseSchema>;
export type CreateAdminExtensionApiKeyRequest = z.infer<typeof createAdminExtensionApiKeyRequestSchema>;
export type CreateAdminExtensionApiKeyResponse = z.infer<typeof createAdminExtensionApiKeyResponseSchema>;
export type FindAdminExtensionApiKeyRequest = z.infer<typeof findAdminExtensionApiKeyRequestSchema>;
export type FindAdminExtensionApiKeyResponse = z.infer<typeof findAdminExtensionApiKeyResponseSchema>;
export type AdminExtensionApiKeyDetailResponse = z.infer<typeof adminExtensionApiKeyDetailResponseSchema>;
export type AdjustAdminExtensionApiKeyQuotaRequest = z.infer<typeof adjustAdminExtensionApiKeyQuotaRequestSchema>;
export type AdjustAdminExtensionApiKeyQuotaResponse = z.infer<typeof adjustAdminExtensionApiKeyQuotaResponseSchema>;
export type InvalidateAdminExtensionApiKeyRequest = z.infer<typeof invalidateAdminExtensionApiKeyRequestSchema>;
export type InvalidateAdminExtensionApiKeyResponse = z.infer<typeof invalidateAdminExtensionApiKeyResponseSchema>;
export type AdminExtensionApiKeyErrorCode = z.infer<typeof adminExtensionApiKeyErrorCodeSchema>;
