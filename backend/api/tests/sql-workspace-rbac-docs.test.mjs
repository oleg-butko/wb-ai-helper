import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runCase } from "./helpers/test-helpers.mjs";


await runCase("initial bootstrap installs transactional ownership transfer RPC", async () => {
  const sql = await readFile(new URL("../../docs/SQL/bootstrap-supabase-initial.sql", import.meta.url), "utf8");

  assert.match(sql, /create or replace function public\.transfer_workspace_ownership\s*\(/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /update public\.workspace_memberships[\s\S]+set role = 'admin'/i);
  assert.match(sql, /update public\.workspace_memberships[\s\S]+set role = 'owner'/i);
});

await runCase("full reset removes transactional ownership transfer RPC", async () => {
  const sql = await readFile(new URL("../../docs/SQL/reset-supabase-full.sql", import.meta.url), "utf8");

  assert.match(
    sql,
    /drop function if exists public\.transfer_workspace_ownership\(uuid, uuid, uuid\) cascade;/i,
  );
});

await runCase("AI profile activation RPCs qualify is_active column references", async () => {
  const sqlFiles = [
    "../../docs/SQL/bootstrap-supabase-initial.sql",
    "../../docs/SQL/extension-api.sql",
  ];

  for (const sqlFile of sqlFiles) {
    const sql = await readFile(new URL(sqlFile, import.meta.url), "utf8");

    assert.match(sql, /where ai_provider_profiles\.is_active = true/i);
    assert.match(sql, /where ai_prompt_profiles\.is_active = true/i);
    assert.doesNotMatch(sql, /where is_active = true\s+and id <> profile_id/i);
  }
});

await runCase("extension quota RPCs qualify quota column references", async () => {
  const sqlFiles = [
    "../../docs/SQL/bootstrap-supabase-initial.sql",
    "../../docs/SQL/extension-api.sql",
  ];

  for (const sqlFile of sqlFiles) {
    const sql = await readFile(new URL(sqlFile, import.meta.url), "utf8");

    assert.match(sql, /set quota_used = extension_api_keys\.quota_used \+ p_amount/i);
    assert.match(sql, /extension_api_keys\.quota_used \+ p_amount <= extension_api_keys\.quota_total/i);
    assert.match(sql, /set quota_total = extension_api_keys\.quota_total \+ p_delta/i);
    assert.match(sql, /extension_api_keys\.quota_total \+ p_delta >= extension_api_keys\.quota_used/i);
    assert.doesNotMatch(sql, /set quota_used = quota_used \+ p_amount/i);
    assert.doesNotMatch(sql, /quota_used \+ p_amount <= quota_total/i);
    assert.doesNotMatch(sql, /set quota_total = quota_total \+ p_delta/i);
    assert.doesNotMatch(sql, /quota_total \+ p_delta >= quota_used/i);
  }
});
