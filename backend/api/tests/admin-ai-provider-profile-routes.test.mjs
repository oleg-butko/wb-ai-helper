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
    temperature: 1,
    maxTokens: 500,
    providerRouting: { mode: "default" },
    isActive: false,
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
    async activateAdminAiProviderProfile() {
      return createProfile({
        isActive: true,
      });
    },
    async getAdminAiProviderProfileSecret() {
      return {
        id: profileId,
        label: "Kimi profile",
        baseUrl: "https://api.moonshot.ai/v1",
        apiKey: "sk-test",
        defaultModel: "kimi-k2.5",
        temperature: 0.7,
        maxTokens: 640,
        providerRouting: { mode: "only-one", only: "moonshot" },
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
        temperature: 0.6,
        maxTokens: 700,
        providerRouting: {
          mode: "fallback",
          order: ["name1", "name2"],
        },
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
        temperature: 0.6,
        maxTokens: 700,
        providerRouting: {
          mode: "fallback",
          order: ["name1", "name2"],
        },
        adminUserId,
      },
    ]);
  } finally {
    await app.close();
  }
});

await runCase("POST /v1/admin/ai-provider-profiles validates generation and routing settings", async () => {
  const app = buildApiApp({ services: createServices() });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/ai-provider-profiles",
      headers: { authorization: "Bearer valid-token" },
      payload: {
        label: "Invalid profile",
        baseUrl: "https://api.provider.example/v1",
        apiKey: "secret",
        temperature: 3,
        maxTokens: 0,
        providerRouting: { mode: "fallback", order: [] },
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "admin_ai_provider_profile_invalid");
  } finally {
    await app.close();
  }
});

await runCase("PATCH /v1/admin/ai-provider-profiles/:profileId saves generation settings", async () => {
  const calls = [];
  const app = buildApiApp({
    services: createServices({
      async updateAdminAiProviderProfile(input) {
        calls.push(input);
        return createProfile({
          defaultModel: input.defaultModel,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          providerRouting: input.providerRouting,
        });
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/admin/ai-provider-profiles/${profileId}`,
      headers: { authorization: "Bearer valid-token" },
      payload: {
        defaultModel: "updated-model",
        temperature: 0.25,
        maxTokens: 900,
        providerRouting: { mode: "only-one", only: "name1" },
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().profile.temperature, 0.25);
    assert.deepEqual(calls, [{
      profileId,
      defaultModel: "updated-model",
      temperature: 0.25,
      maxTokens: 900,
      providerRouting: { mode: "only-one", only: "name1" },
    }]);
  } finally {
    await app.close();
  }
});

await runCase("POST /v1/admin/ai-provider-profiles/:profileId/activate activates a profile", async () => {
  const calls = [];
  const app = buildApiApp({
    services: createServices({
      async activateAdminAiProviderProfile(input) {
        calls.push(input);
        return createProfile({
          isActive: true,
        });
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/ai-provider-profiles/${profileId}/activate`,
      headers: {
        authorization: "Bearer valid-token",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().profile.isActive, true);
    assert.deepEqual(calls, [
      {
        profileId,
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
    assert.equal(fetchCalls[0].body.temperature, 0.7);
    assert.equal(fetchCalls[0].body.max_tokens, 640);
    assert.deepEqual(fetchCalls[0].body.provider, { only: ["moonshot"] });
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
  }
});
