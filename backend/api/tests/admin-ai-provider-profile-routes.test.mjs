import assert from "node:assert/strict";
import { runCase } from "./helpers/test-helpers.mjs";

import { buildApiApp } from "../app.mjs";
import { createQueueService } from "../core/queue/service.mjs";

const profileId = "33333333-3333-4333-8333-333333333333";
const adminUserId = "user-123";

function createProfile(overrides = {}) {
  return {
    id: profileId,
    label: "Kimi profile",
    baseUrl: "https://api.moonshot.ai/v1",
    defaultModel: "kimi-k2.5",
    hasApiKey: true,
    apiKeyPreview: "sk-j…JqAK",
    createdAt: "2026-06-25T00:00:00.000Z",
    updatedAt: "2026-06-25T00:00:00.000Z",
    ...overrides,
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
    async listAdminAiProviderProfiles() {
      return [createProfile()];
    },
    async createAdminAiProviderProfile(input) {
      return createProfile({
        label: input.label,
        baseUrl: input.baseUrl,
        defaultModel: input.defaultModel,
      });
    },
    async updateAdminAiProviderProfile(input) {
      return createProfile({
        defaultModel: input.defaultModel,
      });
    },
    async getAdminAiProviderProfileSecret() {
      return {
        id: profileId,
        label: "Kimi profile",
        baseUrl: "https://api.moonshot.ai/v1",
        apiKey: "sk-test",
        defaultModel: "kimi-k2.5",
      };
    },
    ...createQueueService(),
    ...overrides,
  };
}

await runCase("admin AI provider routes reject requests without authorization", async () => {
  const app = buildApiApp({
    services: createServices(),
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/ai-provider-profiles",
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "authorization_required");
  } finally {
    await app.close();
  }
});

await runCase("admin AI provider routes require an admin database row", async () => {
  let serviceCalled = false;
  const app = buildApiApp({
    services: createServices({
      async isAppAdminEmail() {
        return false;
      },
      async listAdminAiProviderProfiles() {
        serviceCalled = true;
        return [];
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/ai-provider-profiles",
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

await runCase("POST /v1/admin/ai-provider-profiles creates a profile without returning the raw API key", async () => {
  const calls = [];
  const app = buildApiApp({
    services: createServices({
      async createAdminAiProviderProfile(input) {
        calls.push(input);
        return createProfile({
          label: input.label,
          baseUrl: input.baseUrl,
          defaultModel: input.defaultModel,
        });
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/ai-provider-profiles",
      headers: {
        authorization: "Bearer valid-token",
      },
      payload: {
        label: "Kimi profile",
        baseUrl: "https://api.moonshot.ai/v1",
        apiKey: "sk-secret",
        defaultModel: "kimi-k2.5",
      },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().profile.label, "Kimi profile");
    assert.equal("apiKey" in response.json().profile, false);
    assert.deepEqual(calls, [
      {
        label: "Kimi profile",
        baseUrl: "https://api.moonshot.ai/v1",
        apiKey: "sk-secret",
        defaultModel: "kimi-k2.5",
        adminUserId,
      },
    ]);
  } finally {
    await app.close();
  }
});

await runCase("GET /v1/admin/ai-provider-profiles/:profileId/models lists provider models", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url: url.toString(), init });
    return Response.json({
      data: [{ id: "kimi-k2.5" }, { id: "kimi-latest" }],
    });
  };
  const app = buildApiApp({
    services: createServices(),
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: `/v1/admin/ai-provider-profiles/${profileId}/models`,
      headers: {
        authorization: "Bearer valid-token",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().models, [{ id: "kimi-k2.5" }, { id: "kimi-latest" }]);
    assert.equal(fetchCalls[0].url, "https://api.moonshot.ai/v1/models");
    assert.equal(fetchCalls[0].init.headers.authorization, "Bearer sk-test");
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
  }
});

await runCase("POST /v1/admin/ai-provider-profiles/:profileId/check runs a chat completion", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url: url.toString(), body: JSON.parse(init.body) });
    return Response.json({
      choices: [{ message: { content: "ok" } }],
    });
  };
  const app = buildApiApp({
    services: createServices(),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/ai-provider-profiles/${profileId}/check`,
      headers: {
        authorization: "Bearer valid-token",
      },
      payload: {
        model: "kimi-k2.5",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().ok, true);
    assert.equal(response.json().responseText, "ok");
    assert.equal(fetchCalls[0].url, "https://api.moonshot.ai/v1/chat/completions");
    assert.equal(fetchCalls[0].body.model, "kimi-k2.5");
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
  }
});
