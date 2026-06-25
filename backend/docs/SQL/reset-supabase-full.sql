-- Full QuietShift Supabase reset
--
-- Goal:
-- - leave the project with no QuietShift data
-- - remove registered auth users
-- - remove storage objects and buckets
-- - drop project-specific public tables, triggers, policies, and helper functions
--
-- Design:
-- - safe to run on a clean Supabase install
-- - idempotent: every step tolerates missing objects
-- - intended for SQL editor / postgres role execution

begin;

-- Disable the auth -> profiles trigger first so auth cleanup cannot recreate rows.
drop trigger if exists on_auth_user_created on auth.users;

-- Drop project tables. CASCADE removes indexes and dependent constraints.
drop table if exists public.extension_errors cascade;
drop table if exists public.extension_generation_events cascade;
drop table if exists public.extension_generation_requests cascade;
drop table if exists public.extension_api_key_users cascade;
drop table if exists public.extension_users cascade;
drop table if exists public.extension_api_key_quota_events cascade;
drop table if exists public.extension_api_keys cascade;
drop table if exists public.ai_prompt_profiles cascade;
drop table if exists public.ai_provider_profiles cascade;
drop table if exists public.admins cascade;
drop table if exists public.workspace_module_roles cascade;
drop table if exists public.workspace_memberships cascade;
drop table if exists public.workspaces cascade;
drop table if exists public.user_module_roles cascade;
drop table if exists public.workspace_files cascade;
drop table if exists public.profiles cascade;

-- Drop project helper triggers/functions.
drop function if exists public.adjust_extension_api_key_quota(uuid, integer, text, uuid) cascade;
drop function if exists public.consume_extension_api_key_quota(uuid, integer, uuid, text) cascade;
drop function if exists public.activate_ai_provider_profile(uuid, uuid) cascade;
drop function if exists public.activate_ai_prompt_profile(uuid, uuid) cascade;
drop function if exists public.handle_ai_prompt_profiles_updated_at() cascade;
drop function if exists public.handle_extension_generation_requests_updated_at() cascade;
drop function if exists public.handle_extension_api_keys_updated_at() cascade;
drop function if exists public.handle_ai_provider_profiles_updated_at() cascade;
drop function if exists public.handle_workspace_module_roles_updated_at() cascade;
drop function if exists public.handle_workspace_memberships_updated_at() cascade;
drop function if exists public.handle_workspaces_updated_at() cascade;
drop function if exists public.handle_workspace_files_updated_at() cascade;
drop function if exists public.handle_user_module_roles_updated_at() cascade;
drop function if exists public.transfer_workspace_ownership(uuid, uuid, uuid) cascade;
drop function if exists public.handle_updated_at() cascade;
drop function if exists public.handle_new_user() cascade;

-- Storage reset note:
-- Supabase SQL editor roles do not own storage.objects / storage.buckets and direct
-- deletion is blocked by Storage protection triggers. A pure SQL script cannot fully
-- wipe Storage here.
--
-- After running this script, clear Storage separately via the Supabase Dashboard,
-- CLI, or Storage API if you need bucket/object removal too.
do $$
begin
  raise notice 'Storage buckets/objects were not deleted by this SQL reset. Clear them via Supabase Storage API, CLI, or Dashboard if needed.';
end;
$$;

-- Remove auth-side data.
delete from auth.identities;
delete from auth.sessions;
delete from auth.refresh_tokens;
delete from auth.one_time_tokens;
delete from auth.mfa_factors;
delete from auth.mfa_challenges;
delete from auth.mfa_amr_claims;
delete from auth.sso_providers;
delete from auth.sso_domains;
delete from auth.audit_log_entries;
delete from auth.flow_state;
delete from auth.users;

commit;
