export * from "./admin-ai-prompt-profiles.mjs";

import type { z } from "zod";

import {
  adminAiPromptProfileListResponseSchema,
  adminAiPromptProfilePreviewResponseSchema,
  adminAiPromptProfileResponseSchema,
} from "./admin-ai-prompt-profiles.mjs";

export type AdminAiPromptProfileListResponse = z.infer<
  typeof adminAiPromptProfileListResponseSchema
>;
export type AdminAiPromptProfileResponse = z.infer<
  typeof adminAiPromptProfileResponseSchema
>;
export type AdminAiPromptProfilePreviewResponse = z.infer<
  typeof adminAiPromptProfilePreviewResponseSchema
>;
