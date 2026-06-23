import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runCase } from "./helpers/test-helpers.mjs";


await runCase("frontend workspace RBAC helper has no legacy compatibility capability fallback", async () => {
  const source = await readFile(new URL("../../src/core/authz/module-access.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /resolveLegacyCompatibilityCapabilities/);
  assert.doesNotMatch(source, /WORKSPACE_RBAC_STRICT/);
  assert.doesNotMatch(source, /isMissingWorkspaceTables/);
});

await runCase("admin API key page requires database-backed admin access", async () => {
  const source = await readFile(
    new URL("../../src/app/[locale]/(app)/admin/api-keys/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /isAdminEmail\(user\.email\)/);
  assert.match(source, /notFound\(\)/);
  assert.doesNotMatch(source, /APP_ADMIN_EMAILS/);
});
