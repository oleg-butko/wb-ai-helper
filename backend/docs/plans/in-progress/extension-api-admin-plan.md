# Extension API and API-key Administration Plan

**Goal:** Add a Fastify API that the Chrome extension can call with `x-api-key` and an extension-generated UUIDv7 `user_id`, then add admin tooling for API-key lifecycle, quota auditing, invalidation, lookup by raw key value, generation logs, and error reports.

**Current status:** In progress.

## Completed

- Committed `c9e9b77 feat(backend): add extension review response API foundation`.
- Added Fastify route `POST /v1/extension/review-response`.
- Added shared Zod contract in `src/shared/api/extension.*`.
- Added `x-api-key` resolver with informative failures for:
  - missing API key;
  - invalid API key;
  - invalidated API key;
  - exhausted quota.
- Added Supabase service methods for:
  - API-key hash lookup;
  - generation request create/update;
  - generation step events;
  - error collection;
  - extension auth-user provisioning;
  - API-key/user usage association;
  - atomic quota consumption through RPC;
  - admin lookup of a pasted raw API key by hashing it server-side.
- Added extension/admin API schema to `docs/SQL/bootstrap-supabase-initial.sql` with:
  - `admins`;
  - `extension_api_keys`;
  - `extension_api_key_quota_events`;
  - `extension_users`;
  - `extension_api_key_users`;
  - `extension_generation_requests`;
  - `extension_generation_events`;
  - `extension_errors`;
  - `consume_extension_api_key_quota(...)`.
- Added initial stub review-response output with backend diagnostics until the OpenAI-compatible provider is configured.
- Ensured no extension Supabase user is created when the API key is invalid, invalidated, or out of quota.
- Ensured quota is checked before generation and consumed only after successful generation.
- Switched app-admin checks toward Supabase `public.admins`.
- Blocked Supabase users marked with `app_metadata.account_type = "extension"` from the Next.js frontend.
- Updated admin docs and changelogs.
- Added route coverage and included the extension route suite in `test:api:routes`.
- Added admin API-key Fastify routes for list/create/find/detail/quota adjustment/invalidation.
- Added shared admin API-key contracts.
- Added Next proxy routes under `/api/admin/extension-api-keys...`.
- Added minimal admin page at `/[locale]/admin/api-keys` for key creation, raw-key lookup, quota updates, invalidation, quota history, and recent errors.
- Added admin API-key route coverage and included it in `test:api:routes`.
- Updated `docs/SQL/reset-supabase-full.sql` and `docs/SQL/bootstrap-supabase-initial.sql` so Supabase Studio reset/bootstrap includes the extension/admin API-key schema.
- Added Next proxy response validation tests for `/api/admin/extension-api-keys...`.
- Added source-level guard coverage that the admin API-key page requires database-backed admin access.
- Added direct package scripts for the new extension/admin API-key test suites.
- Hardened the minimal admin page by showing extension users and generation requests for the selected key, and by requiring API-key id confirmation before invalidation.
- Added an admin-only app navigation item for `/[locale]/admin/api-keys`, guarded by the Supabase `admins` table check.
- Added local filtering and pagination over the loaded admin API-key list.
- Moved admin API-key page/card labels and messages into the English/Russian dictionaries.
- Replaced the generic extension review request payload with the parsed-data schema shown by the extension modal:
  - `name`;
  - `product_details`;
  - `feedback_reasons`;
  - `rating`;
  - `product_name`;
  - `product_url`;
  - `vendor_code_1`;
  - `vendor_code_2`;
  - `colors`;
  - `size`.
- Added admin AI-provider profile support for OpenAI-compatible providers:
  - Supabase table `ai_provider_profiles`;
  - Fastify admin routes for profile create/list/update, model listing, and provider check;
  - Next proxy routes under `/api/admin/ai-provider-profiles`;
  - admin page at `/[locale]/admin/ai-providers`;
  - Kimi-oriented defaults (`https://api.moonshot.ai/v1`, `kimi-k2.5`);
  - server-side provider API-key storage with only masked preview returned to the browser.
- Updated `docs/SQL/reset-supabase-full.sql` and `docs/SQL/bootstrap-supabase-initial.sql` with the AI-provider profile schema.
- Added one globally active AI-provider profile:
  - `ai_provider_profiles.is_active`;
  - unique partial active-profile index;
  - `activate_ai_provider_profile(...)` RPC;
  - Fastify and Next proxy activation routes;
  - admin UI active/inactive status and activation action.
- Connected `POST /v1/extension/review-response` to the active prompt profile and active OpenAI-compatible provider profile:
  - renders the active product-details template from the extension review JSON;
  - calls the active provider `/chat/completions` endpoint with active provider default model;
  - records prompt-rendered, provider-started, provider-succeeded, quota-consumed, and error events;
  - consumes quota only after provider text is generated successfully;
  - stores the provider response and diagnostics in the generation request row;
  - returns explicit configuration errors when the active prompt/provider/model is missing.

## Verified

- `npm run test:api:routes`
- `node scripts/run-test-suite.mjs api:routes:admin-extension-api-keys`
- `node scripts/run-test-suite.mjs api:routes:extension`
- `node scripts/run-test-suite.mjs api:next-proxy:admin-extension-api-keys`
- `npm run test:api:frontend-workspace-rbac`
- `npm run test:api:admin-workspace-routes`
- `npm run test:api:next-proxy:admin-workspaces`
- `npm run test:api:app-admin-access`
- `npm run test:api:routes:admin-ai-provider-profiles`
- `npm run test:api:routes:extension`
- `npm run test:api:all`
- `npm run typecheck`
- `npm run build`
- `git diff --check`

## Product decisions already confirmed

- One API key can be shared by many extension `user_id`s.
- Quota is global per API key.
- Quota decrements only after successful AI generation.
- Failed calls do not consume quota.
- Generation steps and errors must be stored for admin reporting.
- Extension auth uses `x-api-key`.
- AI provider/model is OpenAI API compatible.
- The first provider profile target is Kimi/Moonshot.
- Responses should be stored in Supabase.
- Admins are normal Supabase Auth users whose lowercased email is manually inserted into `public.admins`.
- Admins must be able to paste a raw API key and retrieve its info/history.
- Extension-created users use `<uuid>@extension.com`, password equal to API key, and are blocked from the Next frontend by app logic.

## Remaining work

### 1. Tests

Completed coverage verifies:

- admin key route auth denial;
- admin table authorization;
- create key returns raw key once;
- find-by-value calls the server-side lookup;
- quota grant/removal route wiring;
- invalidation route wiring.
- Next proxy response validation;
- frontend source/admin visibility for the API-key admin page.

No required test tasks remain for the current slice.

### 2. Manual UI hardening

No required manual UI hardening tasks remain for the current slice.

### 3. Follow-up integration

No required provider-integration tasks remain for the current slice.
