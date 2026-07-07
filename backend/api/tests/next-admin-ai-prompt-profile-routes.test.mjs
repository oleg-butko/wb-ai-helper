import assert from "node:assert/strict";

import { createAdminAiPromptProfileDetailRouteHandlers } from "../../src/app/api/admin/ai-prompt-profiles/[profileId]/route-handlers.mjs";
import { createNextProxyDependencies, readJson, runCase } from "./helpers/test-helpers.mjs";

const profileId = "44444444-4444-4444-8444-444444444444";

function createDependencies({
  accessToken = "token-123",
  fetchImplementation = async () => Response.json({ ok: true }),
} = {}) {
  return createNextProxyDependencies({
    accessToken,
    fetchImplementation,
  });
}

await runCase("admin AI prompt profile Next proxy returns 401 when the session is missing", async () => {
  const handlers = createAdminAiPromptProfileDetailRouteHandlers(
    createDependencies({
      accessToken: null,
    }),
  );

  const response = await handlers.DELETE(
    new Request(`http://localhost/api/admin/ai-prompt-profiles/${profileId}`),
    {
      params: Promise.resolve({ profileId }),
    },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await readJson(response), {
    error: "invalid_session",
    message: "The current session is missing or invalid.",
  });
});

await runCase("admin AI prompt profile Next proxy forwards delete without JSON content type", async () => {
  let fetchCall = null;
  const handlers = createAdminAiPromptProfileDetailRouteHandlers(
    createDependencies({
      fetchImplementation: async (url, init) => {
        fetchCall = { url, init };
        return Response.json({ ok: true });
      },
    }),
  );

  const response = await handlers.DELETE(
    new Request(`http://localhost/api/admin/ai-prompt-profiles/${profileId}`),
    {
      params: Promise.resolve({ profileId }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(fetchCall.url, `http://internal-api.test/v1/admin/ai-prompt-profiles/${profileId}`);
  assert.equal(fetchCall.init.method, "DELETE");
  assert.equal(fetchCall.init.headers.authorization, "Bearer token-123");
  assert.equal(fetchCall.init.headers["content-type"], undefined);
  assert.equal(fetchCall.init.body, undefined);
  assert.deepEqual(await readJson(response), { ok: true });
});
