export * from "./extension.mjs";

import type { z } from "zod";

import {
  extensionReviewErrorCodeSchema,
  extensionReviewRequestSchema,
  extensionReviewResponseSchema,
} from "./extension.mjs";

export type ExtensionReviewRequest = z.infer<typeof extensionReviewRequestSchema>;
export type ExtensionReviewResponse = z.infer<typeof extensionReviewResponseSchema>;
export type ExtensionReviewErrorCode = z.infer<typeof extensionReviewErrorCodeSchema>;
