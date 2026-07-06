import { z } from "zod";

import { extensionParsedReviewSchema } from "./extension.mjs";

export const allowedPromptTemplateKeys = [
  "name",
  "product_details",
  "feedback_reasons",
  "rating",
  "product_name",
  "product_url",
  "vendor_code_1",
  "vendor_code_2",
  "colors",
  "size",
];

export const defaultPromptExamplePayload = {
  name: "Наталья",
  product_details: [
    "Покупка: 10.06.2026",
    "Плюсы: Ничего",
    "Минусы: плохое качество",
    "Комментарий: Голимая синтетика. Кто пишет отзывы?",
  ],
  feedback_reasons: ["Отказ", "Жалоба одобрена"],
  rating: 1,
  product_name: "Парные худи",
  product_url: "https://www.wildberries.ru/catalog/637477223/detail.aspx",
  vendor_code_1: "худи_коричневый",
  vendor_code_2: "637477223",
  colors: "Коричневый, коричневый мрамор, коричневый ротанг, коричневый меланж, светло-коричневый",
  size: "M",
};

export const defaultPromptProfileLabel = "Default review response prompt";

export const defaultSystemPrompt =
  "You are an assistant helping a Wildberries seller write polite, concise, useful responses to customer reviews. Reply in Russian. Do not invent facts. If the review is negative, acknowledge the issue and answer professionally.";

export const defaultProductDetailsTemplate = `Customer review data:

Customer name: {{name}}
Rating: {{rating}} / 5

Product:
- Name: {{product_name}}
- URL: {{product_url}}
- Vendor code 1: {{vendor_code_1}}
- Vendor code 2: {{vendor_code_2}}
- Colors: {{colors}}
- Size: {{size}}

Product details:
{{product_details}}

Feedback reasons:
{{feedback_reasons}}`;

export const adminAiPromptProfileSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  systemPrompt: z.string(),
  productDetailsTemplate: z.string(),
  examplePayload: extensionParsedReviewSchema,
  isActive: z.boolean(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const adminAiPromptProfileListResponseSchema = z.object({
  profiles: z.array(adminAiPromptProfileSchema),
});

export const createAdminAiPromptProfileRequestSchema = z.object({
  label: z.string().trim().min(1).max(120),
  systemPrompt: z.string().trim().min(1).max(20_000),
  productDetailsTemplate: z.string().trim().min(1).max(20_000),
  examplePayload: extensionParsedReviewSchema.default(defaultPromptExamplePayload),
});

export const updateAdminAiPromptProfileRequestSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  systemPrompt: z.string().trim().min(1).max(20_000).optional(),
  productDetailsTemplate: z.string().trim().min(1).max(20_000).optional(),
  examplePayload: extensionParsedReviewSchema.optional(),
});

export const adminAiPromptProfileResponseSchema = z.object({
  profile: adminAiPromptProfileSchema,
});

export const previewAdminAiPromptProfileRequestSchema = z.object({
  examplePayload: extensionParsedReviewSchema.optional(),
  productDetailsTemplate: z.string().trim().min(1).max(20_000).optional(),
});

export const adminAiPromptProfilePreviewResponseSchema = z.object({
  profileId: z.string().uuid(),
  systemPrompt: z.string(),
  productDetailsPrompt: z.string(),
  usedExamplePayload: extensionParsedReviewSchema,
  unknownPlaceholders: z.array(z.string()),
});

export const adminAiPromptProfileErrorCodeSchema = z.enum([
  "authorization_required",
  "invalid_session",
  "app_admin_required",
  "admin_ai_prompt_profile_not_found",
  "admin_ai_prompt_profile_invalid",
  "admin_ai_prompt_profile_label_conflict",
  "admin_ai_prompt_profile_unknown_placeholders",
  "admin_ai_prompt_profile_list_failed",
  "admin_ai_prompt_profile_create_failed",
  "admin_ai_prompt_profile_update_failed",
  "admin_ai_prompt_profile_preview_failed",
  "admin_ai_prompt_profile_activate_failed",
  "internal_api_error",
]);

export const adminAiPromptProfileErrorResponseSchema = z.object({
  error: adminAiPromptProfileErrorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
