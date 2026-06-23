# Changelog

## Extension API foundation

Problem: the extension needs a backend API that can be called without website registration while still enforcing API-key quota, creating Supabase-linked extension users, and preserving enough history for admin reports.

Solution: added a Fastify `/v1/extension/review-response` foundation using `x-api-key`, extension `user_id`, Supabase-backed API-key lookup, pre-generation quota checks, extension-user provisioning, generation request storage, step events, error collection, and post-success atomic quota consumption. The route returns a deterministic stub response with backend diagnostics until the OpenAI-compatible provider is added.

## Admin API-key management

Problem: admins need to generate API keys, find keys by pasted raw value, change quota with audit history, invalidate keys, and inspect key usage/errors from the website.

Solution: added admin-table-guarded Fastify API-key routes, shared admin contracts, Supabase service methods, Next proxy routes, and a minimal `/[locale]/admin/api-keys` page. Raw API keys are returned only on creation; later lookup hashes the pasted value server-side.

## Database-backed admins

Problem: the backend had app-admin gating through `APP_ADMIN_EMAILS`, but admin users now need to be managed manually in Supabase Studio through a table.

Solution: added the `public.admins` table to the extension API SQL, switched Fastify admin-route authorization and the workspace page admin visibility to table-backed checks, updated admin setup docs, and blocked Supabase users marked as extension accounts from the Next.js frontend.
