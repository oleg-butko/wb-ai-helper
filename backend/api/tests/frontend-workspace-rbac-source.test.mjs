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
  assert.match(source, /description: ""/);
  assert.match(source, /highlights: \[\]/);
  assert.doesNotMatch(source, /APP_ADMIN_EMAILS/);
});

await runCase("admin AI provider page uses compact header", async () => {
  const source = await readFile(
    new URL("../../src/app/[locale]/(app)/admin/ai-providers/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /description: ""/);
  assert.match(source, /highlights: \[\]/);
  assert.doesNotMatch(source, /Create provider profiles, list available models/);
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
  assert.match(homeSource, /\/admin\/prompts/);
  assert.match(homeSource, /showMarketingNav=\{false\}/);
});

await runCase("app theme color scheme is server rendered from a cookie", async () => {
  const layoutSource = await readFile(new URL("../../src/app/layout.tsx", import.meta.url), "utf8");
  const providerSource = await readFile(new URL("../../src/components/app-provider.tsx", import.meta.url), "utf8");
  const headerSource = await readFile(new URL("../../src/components/site-header.tsx", import.meta.url), "utf8");
  const helperSource = await readFile(new URL("../../src/lib/theme/color-scheme.ts", import.meta.url), "utf8");

  assert.match(layoutSource, /cookies\(\)/);
  assert.match(layoutSource, /<Script/);
  assert.match(layoutSource, /strategy="beforeInteractive"/);
  assert.match(layoutSource, /getColorSchemeBootstrapScript\(initialColorScheme\)/);
  assert.match(layoutSource, /data-mantine-color-scheme=\{initialColorScheme\}/);
  assert.match(layoutSource, /<AppProvider initialColorScheme=\{initialColorScheme\}>/);
  assert.match(providerSource, /defaultColorScheme=\{initialColorScheme\}/);
  assert.match(headerSource, /setColorSchemeCookie\(nextColorScheme\)/);
  assert.match(helperSource, /wb-ai-helper-color-scheme/);
  assert.match(helperSource, /mantine-color-scheme-value/);
});

await runCase("admin API key filters are debounced and reason inputs are isolated", async () => {
  const source = await readFile(
    new URL("../../src/modules/admin/components/admin-extension-api-keys-card.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /setTimeout\(\(\) => \{/);
  assert.match(source, /}, 2000\)/);
  assert.match(source, /rightSection=\{isFilterPending \? <Loader size="xs" \/> : null\}/);
  assert.match(source, /const QuotaControls = memo/);
  assert.match(source, /const InvalidationControls = memo/);
});

await runCase("admin prompt preview does not force a light background", async () => {
  const source = await readFile(
    new URL("../../src/modules/admin/components/admin-ai-prompt-profiles-card.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /bg="gray\.0"/);
  assert.match(source, /Rendered product_details prompt/);
});

await runCase("admin prompt editor protects the default profile from direct saves", async () => {
  const source = await readFile(
    new URL("../../src/modules/admin/components/admin-ai-prompt-profiles-card.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /defaultPromptProfileLabel/);
  assert.match(source, /const isDefaultProfileSelected = Boolean\(selectedProfile\?\.isDefault\)/);
  assert.match(source, /isDefaultProfileSelected \? null : \(/);
  assert.match(source, /`\$\{newPromptBaseLabel\} \$\{profiles\.length\}`/);
  assert.match(source, /disabled=\{!selectedProfileId \|\| isDefaultProfileSelected\}/);
  assert.match(source, /Remove/);
  assert.match(source, /variant=\{isDefaultProfileSelected \? "filled" : "light"\}/);
});

await runCase("admin prompt page removes secondary intro blocks", async () => {
  const pageSource = await readFile(
    new URL("../../src/app/[locale]/(app)/admin/prompts/page.tsx", import.meta.url),
    "utf8",
  );
  const shellSource = await readFile(
    new URL("../../src/components/app/app-page-shell.tsx", import.meta.url),
    "utf8",
  );

  assert.match(pageSource, /description: ""/);
  assert.match(pageSource, /highlights: \[\]/);
  assert.doesNotMatch(pageSource, /Edit the active system prompt and the template used to construct product details/);
  assert.doesNotMatch(shellSource, /highlightsTitle/);
  assert.match(shellSource, /description \? \(/);
});

await runCase("admin prompt alerts float and auto close", async () => {
  const source = await readFile(
    new URL("../../src/modules/admin/components/admin-ai-prompt-profiles-card.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /notificationDurationMs = 5000/);
  assert.match(source, /Portal/);
  assert.match(source, /position: "fixed"/);
  assert.match(source, /zIndex: 10000/);
  assert.match(source, /withCloseButton/);
  assert.match(source, /window\.setTimeout/);
  assert.match(source, /<Progress/);
});

await runCase("extension user persistence is idempotent for repeated user_id calls", async () => {
  const source = await readFile(new URL("../../api/services/supabase.mjs", import.meta.url), "utf8");

  assert.match(source, /\.from\("extension_users"\)\s*\.upsert\(/);
  assert.match(source, /onConflict:\s*"user_id"/);
  assert.match(source, /ignoreDuplicates:\s*true/);
});
