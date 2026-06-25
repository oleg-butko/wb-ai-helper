# AI Prompt Profiles Plan

Goal: let admins manage one globally active prompt profile used for extension review-response generation.

## Product decision

- There is exactly one active prompt profile globally.
- A prompt has two editable parts:
  - `system_prompt`
  - `product_details_template`
- `product_details_template` is rendered from the parsed review JSON sent by the extension.
- Admins need a preview that renders the template using editable example parsed JSON.

## Template rules

- Use simple `{{key}}` placeholders.
- Allowed keys are the parsed extension payload keys:
  - `name`
  - `product_details`
  - `feedback_reasons`
  - `rating`
  - `product_name`
  - `product_url`
  - `vendor_code_1`
  - `vendor_code_2`
  - `colors`
  - `size`
- Arrays render as bullet lists.
- Empty scalar values render as `—`.
- Unknown placeholders are validation errors.

## Backend/API scope

Status: implemented in the current slice.

- Add Supabase table `ai_prompt_profiles`.
- Enforce one active prompt profile with a partial unique index.
- Add RPC `activate_ai_prompt_profile(profile_id uuid)` to atomically switch active profile.
- Add shared schemas and renderer.
- Add Fastify admin routes:
  - `GET /v1/admin/ai-prompt-profiles`
  - `POST /v1/admin/ai-prompt-profiles`
  - `PATCH /v1/admin/ai-prompt-profiles/:profileId`
  - `POST /v1/admin/ai-prompt-profiles/:profileId/preview`
  - `POST /v1/admin/ai-prompt-profiles/:profileId/activate`
- Add Next proxy routes under `/api/admin/ai-prompt-profiles`.

## Admin UI scope

Status: implemented in the current slice.

- Add `/[locale]/admin/prompts`.
- Add admin nav link.
- UI supports:
  - list prompt profiles with active badge;
  - create profile;
  - edit selected profile fields;
  - edit example JSON;
  - preview rendered product details prompt;
  - activate profile.

## Verification

Status: completed for the current slice.

- Backend route tests for auth, create/list/update/preview/activate.
- Typecheck/build.
- Full API suite if route coverage passes.

Commands run:

- `npm run test:api:routes:admin-ai-prompt-profiles`
- `npm run test:api:frontend-workspace-rbac`
- `npm run typecheck`
- `npm run build`
- `npm run test:api:all`

## Later integration

- Connect `/v1/extension/review-response` to the active prompt profile.
- Render the prompt from actual extension payload.
- Send `system_prompt` and rendered product details prompt to the active AI provider.
- Store prompt profile id and rendered prompts with generation request metadata.
