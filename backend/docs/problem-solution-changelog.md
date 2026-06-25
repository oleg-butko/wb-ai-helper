# Changelog

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
