import assert from "node:assert/strict";
import { runCase } from "./helpers/test-helpers.mjs";

import { buildApiApp } from "../app.mjs";
import { createQueueService } from "../core/queue/service.mjs";

const apiKeyId = "11111111-1111-4111-8111-111111111111";
const adminUserId = "user-123";

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

function createServices(overrides = {}) {
  return {
    async verifyAccessToken() {
      return {
        id: adminUserId,
        email: "admin@example.com",
      };
    },
    async isAppAdminEmail() {
      return true;
    },
    async listAdminExtensionApiKeys() {
      return [createApiKeySummary()];
    },
    async createAdminExtensionApiKey() {
      return {
        apiKey: createApiKeySummary({ quotaTotal: 5, quotaUsed: 0, quotaRemaining: 5 }),
        rawApiKey: "wbai_raw-key",
      };
    },
    async findExtensionApiKeyByValue() {
      return createApiKeyDetail();
    },
    async getAdminExtensionApiKeyDetail() {
      return createApiKeyDetail();
    },
    async adjustAdminExtensionApiKeyQuota() {
      return createApiKeySummary({ quotaTotal: 15, quotaRemaining: 13 });
    },
    async invalidateAdminExtensionApiKey() {
      return createApiKeySummary({
        invalidatedAt: "2026-06-23T01:00:00.000Z",
        invalidationReason: "manual",
      });
    },
    ...createQueueService(),
    ...overrides,
  };
}

await runCase("admin extension API key routes reject requests without authorization", async () => {
  const app = buildApiApp({
    services: createServices(),
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/extension-api-keys",
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "authorization_required");
  } finally {
    await app.close();
  }
});

await runCase("admin extension API key routes require an admin database row", async () => {
  let serviceCalled = false;
  const app = buildApiApp({
    services: createServices({
      async isAppAdminEmail() {
        return false;
      },
      async listAdminExtensionApiKeys() {
        serviceCalled = true;
        return [];
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/extension-api-keys",
      headers: {
        authorization: "Bearer valid-token",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error, "app_admin_required");
    assert.equal(serviceCalled, false);
  } finally {
    await app.close();
  }
});

await runCase("GET /v1/admin/extension-api-keys forwards limit to the service", async () => {
  const calls = [];
  const app = buildApiApp({
    services: createServices({
      async listAdminExtensionApiKeys(input) {
        calls.push(input);
        return [createApiKeySummary()];
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/extension-api-keys?limit=12",
      headers: {
        authorization: "Bearer valid-token",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(calls, [{ limit: 12 }]);
    assert.equal(response.json().apiKeys[0].id, apiKeyId);
  } finally {
    await app.close();
  }
});

await runCase("POST /v1/admin/extension-api-keys creates a key and returns raw value once", async () => {
  const calls = [];
  const app = buildApiApp({
    services: createServices({
      async createAdminExtensionApiKey(input) {
        calls.push(input);
        return {
          apiKey: createApiKeySummary({ label: "Promo", quotaTotal: 25, quotaRemaining: 25 }),
          rawApiKey: "wbai_secret",
        };
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/extension-api-keys",
      headers: {
        authorization: "Bearer valid-token",
      },
      payload: {
        label: "Promo",
        quota: 25,
        reason: "launch",
      },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().rawApiKey, "wbai_secret");
    assert.deepEqual(calls, [
      {
        label: "Promo",
        quota: 25,
        reason: "launch",
        adminUserId,
      },
    ]);
  } finally {
    await app.close();
  }
});

await runCase("POST /v1/admin/extension-api-keys/find hashes raw lookup in the service", async () => {
  const calls = [];
  const app = buildApiApp({
    services: createServices({
      async findExtensionApiKeyByValue(input) {
        calls.push(input);
        return createApiKeyDetail();
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/extension-api-keys/find",
      headers: {
        authorization: "Bearer valid-token",
      },
      payload: {
        apiKey: "wbai_secret",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().result.apiKey.id, apiKeyId);
    assert.deepEqual(calls, [{ apiKey: "wbai_secret" }]);
  } finally {
    await app.close();
  }
});

await runCase("GET /v1/admin/extension-api-keys/:apiKeyId returns detail", async () => {
  const calls = [];
  const app = buildApiApp({
    services: createServices({
      async getAdminExtensionApiKeyDetail(input) {
        calls.push(input);
        return createApiKeyDetail();
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: `/v1/admin/extension-api-keys/${apiKeyId}`,
      headers: {
        authorization: "Bearer valid-token",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().result.quotaEvents[0].eventType, "grant");
    assert.deepEqual(calls, [{ apiKeyId }]);
  } finally {
    await app.close();
  }
});

await runCase("POST quota-events forwards audited quota updates", async () => {
  const calls = [];
  const app = buildApiApp({
    services: createServices({
      async adjustAdminExtensionApiKeyQuota(input) {
        calls.push(input);
        return createApiKeySummary({ quotaTotal: 15, quotaRemaining: 13 });
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/extension-api-keys/${apiKeyId}/quota-events`,
      headers: {
        authorization: "Bearer valid-token",
      },
      payload: {
        direction: "grant",
        amount: 5,
        reason: "manual top-up",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().apiKey.quotaTotal, 15);
    assert.deepEqual(calls, [
      {
        apiKeyId,
        direction: "grant",
        amount: 5,
        reason: "manual top-up",
        adminUserId,
      },
    ]);
  } finally {
    await app.close();
  }
});

await runCase("POST invalidate forwards manual invalidation", async () => {
  const calls = [];
  const app = buildApiApp({
    services: createServices({
      async invalidateAdminExtensionApiKey(input) {
        calls.push(input);
        return createApiKeySummary({
          invalidatedAt: "2026-06-23T01:00:00.000Z",
          invalidationReason: "manual",
        });
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/extension-api-keys/${apiKeyId}/invalidate`,
      headers: {
        authorization: "Bearer valid-token",
      },
      payload: {
        reason: "manual",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().apiKey.invalidatedAt, "2026-06-23T01:00:00.000Z");
    assert.deepEqual(calls, [
      {
        apiKeyId,
        reason: "manual",
        adminUserId,
      },
    ]);
  } finally {
    await app.close();
  }
});
