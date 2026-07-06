# Changelog

## Admin utility environment profiles

Problem: reset and snapshot admin utilities hard-coded one configured `useEnv` list, so switching between E2E, local development, and production-like environment files required editing config files.

Solution: added positional environment profiles to the admin utility CLIs. Snapshot commands now accept `save|restore [e2e|dev|prod]`, reset accepts `[e2e|dev|prod] --yes`, and the built-in profiles map to the matching `.env.api.*` plus `.env.*` file pairs while defaulting to `e2e` when omitted.

## Admin utility schema coverage

Problem: the reset and data snapshot admin utilities still used the older workspace-only table lists, so they missed admins, AI provider/prompt profiles, extension API keys, extension users, generation history, and error logs.

Solution: updated the reset fallback table cleanup and snapshot save/restore configuration to cover the current schema with dependency-safe delete/insert order, composite conflict keys for extension API-key users, and documentation about sensitive snapshot contents.

## Protect default prompt profile in the editor

Problem: admins could overwrite the seeded `Default review response prompt` profile from the prompt editor, making it easy to lose the baseline prompt.

Solution: when the default prompt profile is selected, hide the `Save` action and make `Create as new` the primary action so edits are saved as a new profile instead of overwriting the default.

## Extension prompt payload diagnostics and optional characteristics

Problem: the admin prompt preview could look correct while real generation used different parsed JSON from the extension, and products without color or size characteristics should not be rejected or treated as parser failures.

Solution: clarified the admin prompt preview copy so admins know it uses example JSON until saved/activated, allowed missing `colors` and `size` review fields to default to empty strings, and added prompt-render audit details with `product_details` count plus safe previews of the parsed details and rendered user prompt.

## Prompt preview dark-theme surface

Problem: the AI prompt preview cards forced `gray.0` as their background, which looked correct in light theme but produced a white surface with low-contrast text in dark theme.

Solution: removed the fixed light background from prompt preview cards so Mantine can use the current theme surface and text colors.

## Admin AI prompt profiles

Problem: admins need to edit the system prompt and control how parsed extension review JSON becomes the product-details user prompt, with preview before the generation endpoint is connected to real AI output.

Solution: added globally active AI prompt profiles with Supabase schema/RPC, Fastify admin routes, Next proxy routes, `/[locale]/admin/prompts`, template rendering with `{{key}}` placeholders, example JSON validation, and preview output without calling the AI provider.

## Extension API-key validation endpoint

Problem: the extension popup needs a minimal API-key validity check, but using the review-response endpoint for this would create generation records and consume quota.

Solution: added `POST /v1/extension/api-key/check`, which validates `x-api-key`, invalidation status, and remaining quota without creating an extension user or consuming quota. The popup uses this endpoint for its Options tab check button.

## Admin API-key input responsiveness

Problem: typing in unrelated admin API-key inputs, such as invalidation reason, could feel laggy because those input states lived in the same large React component that also rendered API-key tables, history, users, requests, and errors. The list filter also recomputed immediately on every keystroke.

Solution: isolated quota/invalidation form state into small memoized controls, added a two-second debounce before applying the list filter, and showed a small spinner in the filter input while a pending filter is waiting to apply.

## API-key copy fallback

Problem: the admin API-key page showed the one-time raw extension API key, but the Copy button could fail on local HTTP hostnames where the browser Clipboard API is unavailable or restricted.

Solution: replaced the implicit Mantine copy helper with an explicit copy handler that first tries `navigator.clipboard.writeText(...)`, then falls back to a temporary textarea and `document.execCommand("copy")`, with visible success or failure feedback.

## Admin landing and frontend dev env

Problem: after signing in as an admin, the Next frontend could throw because `SUPABASE_SERVICE_ROLE_KEY` existed in `.env.api.local` but `next dev` did not load that file. The root layout also emitted a React script-tag warning, and the home page still showed SaaS marketing sections instead of admin entry points.

Solution: added a `dev:web` wrapper that loads `.env.api.local` before `next dev`, removed script tags from the root/admin-oriented home rendering, and replaced the marketing home content with admin links for extension API keys, AI-provider profiles, and workspace/user access.

## Admin AI-provider profiles

Problem: admins need to configure an OpenAI-compatible AI provider, save its provider API key, choose a model, and verify that the configured provider works before the extension generation endpoint is connected to real AI output.

Solution: added Supabase-backed `ai_provider_profiles`, Fastify admin routes for profile create/list/update, model listing, and chat-completion checks, Next proxy routes, and an admin page at `/[locale]/admin/ai-providers`. Provider API keys are stored server-side and only masked previews are returned to the browser.

## Extension API foundation

Problem: the extension needs a backend API that can be called without website registration while still enforcing API-key quota, creating Supabase-linked extension users, and preserving enough history for admin reports.

Solution: added a Fastify `/v1/extension/review-response` foundation using `x-api-key`, extension `user_id`, Supabase-backed API-key lookup, pre-generation quota checks, extension-user provisioning, generation request storage, step events, error collection, and post-success atomic quota consumption. The route returns a deterministic stub response with backend diagnostics until the OpenAI-compatible provider is added.

## Admin API-key management

Problem: admins need to generate API keys, find keys by pasted raw value, change quota with audit history, invalidate keys, and inspect key usage/errors from the website.

Solution: added admin-table-guarded Fastify API-key routes, shared admin contracts, Supabase service methods, Next proxy routes, and a minimal `/[locale]/admin/api-keys` page. Raw API keys are returned only on creation; later lookup hashes the pasted value server-side.

## Supabase reset/bootstrap coverage

Problem: the standalone extension API SQL existed, but the full reset/bootstrap scripts used from Supabase Studio did not yet include the new extension/admin API-key schema.

Solution: updated `reset-supabase-full.sql` to drop the extension tables/functions and embedded the extension/admin API-key schema plus quota RPCs into `bootstrap-supabase-initial.sql`.

## Extension review request schema

Problem: the extension review-response API accepted an arbitrary `review` object, but the extension already has a concrete modal payload shape for parsed drawer data.

Solution: added a shared Zod schema matching the extension modal fields (`name`, `product_details`, `feedback_reasons`, `rating`, `product_name`, `product_url`, `vendor_code_1`, `vendor_code_2`, `colors`, `size`) and updated route coverage to reject payloads outside that shape.

## Database-backed admins

Problem: the backend had app-admin gating through `APP_ADMIN_EMAILS`, but admin users now need to be managed manually in Supabase Studio through a table.

Solution: added the `public.admins` table to the extension API SQL, switched Fastify admin-route authorization and the workspace page admin visibility to table-backed checks, updated admin setup docs, and blocked Supabase users marked as extension accounts from the Next.js frontend.
