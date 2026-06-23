import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createE2EWebEnv } from "../../scripts/e2e-runtime-env.mjs";
import { runCase } from "./helpers/test-helpers.mjs";

await runCase("e2e web server receives server-only Supabase env", async () => {
  const webEnv = createE2EWebEnv({
    NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.com",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
  });

  assert.equal(webEnv.NEXT_PUBLIC_SUPABASE_URL, "https://supabase.example.com");
  assert.equal(webEnv.SUPABASE_SERVICE_ROLE_KEY, "service-role-secret");
  assert.equal(webEnv.PORT, "3100");
});

await runCase("Playwright config respects PLAYWRIGHT_REUSE_SERVER", async () => {
  const source = await readFile(new URL("../../playwright.config.ts", import.meta.url), "utf8");

  assert.match(source, /reuseExistingServer:\s*process\.env\.PLAYWRIGHT_REUSE_SERVER\s*===\s*"true"/);
  assert.doesNotMatch(source, /reuseExistingServer:\s*true/);
});
