import assert from "node:assert/strict";

import {
  createAdminExtensionApiKeyFindRouteHandlers,
  createAdminExtensionApiKeysRouteHandlers,
} from "../../src/app/api/admin/extension-api-keys/route-handlers.mjs";
import {
  createAdminExtensionApiKeyDetailRouteHandlers,
  createAdminExtensionApiKeyInvalidateRouteHandlers,
  createAdminExtensionApiKeyQuotaRouteHandlers,
} from "../../src/app/api/admin/extension-api-keys/[apiKeyId]/route-handlers.mjs";
import { createNextProxyDependencies, readJson, runCase } from "./helpers/test-helpers.mjs";

const apiKeyId = "11111111-1111-4111-8111-111111111111";
const adminUserId = "33333333-3333-4333-8333-333333333333";

function createApiKeySummary(overrides = {}) {
  return {
    id: apiKeyId,
    label: "Launch key",
    quotaTotal: 10,
    quotaUsed: 2,
    quotaRemaining: 8,
    invalidatedAt: null,
    invalidationReason: null,
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z",
    ...overrides,
  };
}

function createApiKeyDetail() {
  return {
    apiKey: createApiKeySummary(),
    quotaEvents: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        apiKeyId,
        eventType: "grant",
        amount: 10,
        requestId: null,
        reason: "initial",
        createdByAdminUserId: adminUserId,
        createdAt: "2026-06-23T00:00:00.000Z",
      },
    ],
    users: [],
    requests: [],
    errors: [],
  };
}

function createDependencies({
  accessToken = "token-123",
  fetchImplementation = async () => Response.json({ apiKeys: [] }),
} = {}) {
  return createNextProxyDependencies({
    accessToken,
    fetchImplementation,
  });
}

await runCase("admin extension API keys Next proxy returns 401 when the session is missing", async () => {
  const handlers = createAdminExtensionApiKeysRouteHandlers(
    createDependencies({
      accessToken: null,
    }),
  );

  const response = await handlers.GET(new Request("http://localhost/api/admin/extension-api-keys"));

  assert.equal(response.status, 401);
  assert.deepEqual(await readJson(response), {
    error: "invalid_session",
    message: "The current session is missing or invalid.",
  });
});

await runCase("admin extension API keys Next proxy forwards list requests", async () => {
  let fetchCall = null;
  const handlers = createAdminExtensionApiKeysRouteHandlers(
    createDependencies({
      fetchImplementation: async (url, init) => {
        fetchCall = { url, init };
        return Response.json({ apiKeys: [createApiKeySummary()] });
      },
    }),
  );

  const response = await handlers.GET(new Request("http://localhost/api/admin/extension-api-keys?limit=12"));

  assert.equal(response.status, 200);
  assert.equal(fetchCall.url.href, "http://internal-api.test/v1/admin/extension-api-keys?limit=12");
  assert.equal(fetchCall.init.method, "GET");
  assert.equal(fetchCall.init.headers.authorization, "Bearer token-123");
  assert.equal(fetchCall.init.cache, "no-store");
  assert.equal((await readJson(response)).apiKeys[0].id, apiKeyId);
});

await runCase("admin extension API keys Next proxy preserves upstream app-admin denial", async () => {
  const handlers = createAdminExtensionApiKeysRouteHandlers(
    createDependencies({
      fetchImplementation: async () =>
        Response.json(
          {
            error: "app_admin_required",
            message: "The current user is not allowed to use app-admin tools.",
          },
          { status: 403 },
        ),
    }),
  );

  const response = await handlers.GET(new Request("http://localhost/api/admin/extension-api-keys"));

  assert.equal(response.status, 403);
  assert.deepEqual(await readJson(response), {
    error: "app_admin_required",
    message: "The current user is not allowed to use app-admin tools.",
  });
});

await runCase("admin extension API keys Next proxy forwards create requests", async () => {
  let fetchCall = null;
  const handlers = createAdminExtensionApiKeysRouteHandlers(
    createDependencies({
      fetchImplementation: async (url, init) => {
        fetchCall = { url, init };
        return Response.json(
          {
            apiKey: createApiKeySummary({ quotaTotal: 25, quotaUsed: 0, quotaRemaining: 25 }),
            rawApiKey: "wbai_secret",
          },
          { status: 201 },
        );
      },
    }),
  );

  const response = await handlers.POST(
    new Request("http://localhost/api/admin/extension-api-keys", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ label: "Promo", quota: 25, reason: "launch" }),
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(fetchCall.url, "http://internal-api.test/v1/admin/extension-api-keys");
  assert.equal(fetchCall.init.method, "POST");
  assert.equal(fetchCall.init.headers.authorization, "Bearer token-123");
  assert.equal(fetchCall.init.headers["content-type"], "application/json");
  assert.equal(fetchCall.init.body, JSON.stringify({ label: "Promo", quota: 25, reason: "launch" }));
  assert.equal((await readJson(response)).rawApiKey, "wbai_secret");
});

await runCase("admin extension API key find Next proxy forwards raw key lookup", async () => {
  let fetchCall = null;
  const handlers = createAdminExtensionApiKeyFindRouteHandlers(
    createDependencies({
      fetchImplementation: async (url, init) => {
        fetchCall = { url, init };
        return Response.json({ result: createApiKeyDetail() });
      },
    }),
  );

  const response = await handlers.POST(
    new Request("http://localhost/api/admin/extension-api-keys/find", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ apiKey: "wbai_secret" }),
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(fetchCall.url, "http://internal-api.test/v1/admin/extension-api-keys/find");
  assert.equal(fetchCall.init.method, "POST");
  assert.equal(fetchCall.init.body, JSON.stringify({ apiKey: "wbai_secret" }));
  assert.equal((await readJson(response)).result.apiKey.id, apiKeyId);
});

await runCase("admin extension API key detail Next proxy forwards detail requests", async () => {
  let fetchCall = null;
  const handlers = createAdminExtensionApiKeyDetailRouteHandlers(
    createDependencies({
      fetchImplementation: async (url, init) => {
        fetchCall = { url, init };
        return Response.json({ result: createApiKeyDetail() });
      },
    }),
  );

  const response = await handlers.GET(
    new Request(`http://localhost/api/admin/extension-api-keys/${apiKeyId}`),
    {
      params: Promise.resolve({ apiKeyId }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(fetchCall.url, `http://internal-api.test/v1/admin/extension-api-keys/${apiKeyId}`);
  assert.equal(fetchCall.init.method, "GET");
  assert.equal((await readJson(response)).result.quotaEvents[0].eventType, "grant");
});

await runCase("admin extension API key quota Next proxy forwards quota updates", async () => {
  let fetchCall = null;
  const handlers = createAdminExtensionApiKeyQuotaRouteHandlers(
    createDependencies({
      fetchImplementation: async (url, init) => {
        fetchCall = { url, init };
        return Response.json({ apiKey: createApiKeySummary({ quotaTotal: 15, quotaRemaining: 13 }) });
      },
    }),
  );

  const response = await handlers.POST(
    new Request(`http://localhost/api/admin/extension-api-keys/${apiKeyId}/quota-events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ direction: "grant", amount: 5, reason: "manual top-up" }),
    }),
    {
      params: Promise.resolve({ apiKeyId }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(fetchCall.url, `http://internal-api.test/v1/admin/extension-api-keys/${apiKeyId}/quota-events`);
  assert.equal(fetchCall.init.method, "POST");
  assert.equal(fetchCall.init.body, JSON.stringify({ direction: "grant", amount: 5, reason: "manual top-up" }));
  assert.equal((await readJson(response)).apiKey.quotaTotal, 15);
});

await runCase("admin extension API key invalidate Next proxy forwards invalidation", async () => {
  let fetchCall = null;
  const handlers = createAdminExtensionApiKeyInvalidateRouteHandlers(
    createDependencies({
      fetchImplementation: async (url, init) => {
        fetchCall = { url, init };
        return Response.json({
          apiKey: createApiKeySummary({
            invalidatedAt: "2026-06-23T01:00:00.000Z",
            invalidationReason: "manual",
          }),
        });
      },
    }),
  );

  const response = await handlers.POST(
    new Request(`http://localhost/api/admin/extension-api-keys/${apiKeyId}/invalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason: "manual" }),
    }),
    {
      params: Promise.resolve({ apiKeyId }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(fetchCall.url, `http://internal-api.test/v1/admin/extension-api-keys/${apiKeyId}/invalidate`);
  assert.equal(fetchCall.init.method, "POST");
  assert.equal(fetchCall.init.body, JSON.stringify({ reason: "manual" }));
  assert.equal((await readJson(response)).apiKey.invalidatedAt, "2026-06-23T01:00:00.000Z");
});
