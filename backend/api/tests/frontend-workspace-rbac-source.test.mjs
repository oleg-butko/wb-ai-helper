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

await runCase("app navigation includes API-key admin link only after admin check", async () => {
  const shellSource = await readFile(
    new URL("../../src/components/app/app-page-shell.tsx", import.meta.url),
    "utf8",
  );
  const navigationSource = await readFile(
    new URL("../../src/core/navigation/app-navigation.ts", import.meta.url),
    "utf8",
  );

  assert.match(shellSource, /isAdminEmail\(user\.email\)/);
  assert.match(shellSource, /getAppNavigation\(locale, dictionary, \{ isAdmin \}\)/);
  assert.match(navigationSource, /isAdmin/);
  assert.match(navigationSource, /\/admin\/api-keys/);
});

await runCase("marketing home page exposes admin links after admin check", async () => {
  const pageSource = await readFile(
    new URL("../../src/app/[locale]/(marketing)/page.tsx", import.meta.url),
    "utf8",
  );
  const homeSource = await readFile(
    new URL("../../src/components/marketing/home-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(pageSource, /isAdminEmail\(user\.email\)/);
  assert.match(homeSource, /\/admin\/api-keys/);
  assert.match(homeSource, /\/admin\/ai-providers/);
  assert.match(homeSource, /showMarketingNav=\{false\}/);
});
