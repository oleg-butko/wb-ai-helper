export * from "./admin-ai-provider-profiles.mjs";

import type { z } from "zod";

import {
  adminAiProviderProfileCheckResponseSchema,
  adminAiProviderProfileListResponseSchema,
  adminAiProviderProfileModelsResponseSchema,
  aiProviderRoutingSchema,
  createAdminAiProviderProfileResponseSchema,
  updateAdminAiProviderProfileResponseSchema,
} from "./admin-ai-provider-profiles.mjs";

export type AdminAiProviderProfileListResponse = z.infer<
  typeof adminAiProviderProfileListResponseSchema
>;
export type CreateAdminAiProviderProfileResponse = z.infer<
  typeof createAdminAiProviderProfileResponseSchema
>;
export type UpdateAdminAiProviderProfileResponse = z.infer<
  typeof updateAdminAiProviderProfileResponseSchema
>;
export type AdminAiProviderProfileModelsResponse = z.infer<
  typeof adminAiProviderProfileModelsResponseSchema
>;
export type AdminAiProviderProfileCheckResponse = z.infer<
  typeof adminAiProviderProfileCheckResponseSchema
>;
export type AiProviderRouting = z.infer<typeof aiProviderRoutingSchema>;
