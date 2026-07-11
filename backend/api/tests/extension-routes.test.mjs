import assert from "node:assert/strict";

import { buildApiApp } from "../app.mjs";
import { createServices, runCase } from "./helpers/route-test-helpers.mjs";

const extensionUserId = "c2a5f455-c2a5-7338-9883-02f3edc500a7";
const apiKeyId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const promptProfileId = "33333333-3333-4333-8333-333333333333";
const providerProfileId = "44444444-4444-4444-8444-444444444444";
const parsedReview = {
  name: "Наталья",
  product_details: ["Покупка: 10.06.2026", "Плюсы: Ничего", "Минусы: плохое качество"],
  feedback_reasons: ["Отказ", "Жалоба одобрена"],
  rating: 1,
  product_name: "Парные худи",
  product_url: "https://www.wildberries.ru/catalog/637477223/detail.aspx",
  vendor_code_1: "худи_коричневый",
  vendor_code_2: "637477223",
  colors: "Коричневый, коричневый мрамор, коричневый ротанг, коричневый меланж, светло-коричневый",
  size: "M",
};
const {
  colors: _optionalColors,
  size: _optionalSize,
  ...parsedReviewWithoutOptionalCharacteristics
} = parsedReview;

function createExtensionServices(overrides = {}) {
  return createServices({
    async resolveExtensionApiKey() {
      return {
        id: apiKeyId,
        label: "Test key",
        quotaTotal: 10,
        quotaUsed: 3,
        quotaRemaining: 7,
        invalidatedAt: null,
      };
    },
    async createExtensionGenerationRequest() {
      return {
        id: requestId,
        apiKeyId,
        extensionUserId,
        status: "received",
        quotaConsumed: false,
      };
    },
    async recordExtensionGenerationEvent() {},
    async recordExtensionError() {},
    async ensureExtensionUser() {
      return {
        id: extensionUserId,
        email: `${extensionUserId}@extension.com`,
        created: true,
      };
    },
    async getActiveAiPromptProfile() {
      return {
        id: promptProfileId,
        label: "Active prompt",
        systemPrompt: "Reply in Russian.",
        productDetailsTemplate: "Product: {{product_name}}\nRating: {{rating}}",
        examplePayload: parsedReview,
        isActive: true,
        createdAt: "2026-06-25T00:00:00.000Z",
        updatedAt: "2026-06-25T00:00:00.000Z",
      };
    },
    async getActiveAiProviderProfileSecret() {
      return {
        id: providerProfileId,
        label: "Active provider",
        baseUrl: "https://api.provider.example/v1",
        apiKey: "provider-secret",
        defaultModel: "test-model",
        temperature: 0.4,
        maxTokens: 750,
        providerRouting: {
          mode: "fallback",
          order: ["name1", "name2"],
        },
        isActive: true,
      };
    },
    async consumeExtensionApiQuota() {
      return {
        apiKeyId,
        quotaTotal: 10,
        quotaUsed: 4,
        quotaRemaining: 6,
      };
    },
    async updateExtensionGenerationRequest() {},
    ...overrides,
  });
}

await runCase("POST /v1/extension/review-response rejects missing API key", async () => {
  const errors = [];
  const app = buildApiApp({
    services: createExtensionServices({
      async recordExtensionError(input) {
        errors.push(input);
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/extension/review-response",
      payload: {
        user_id: extensionUserId,
        review: parsedReview,
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "api_key_required");
    assert.equal(errors[0].errorCode, "api_key_required");
    assert.equal(errors[0].extensionUserId, extensionUserId);
  } finally {
    await app.close();
  }
});

await runCase("POST /v1/extension/api-key/check validates a key without consuming quota", async () => {
  let ensureUserCalled = false;
  let consumeQuotaCalled = false;
  const app = buildApiApp({
    services: createExtensionServices({
      async ensureExtensionUser() {
        ensureUserCalled = true;
        return null;
      },
      async consumeExtensionApiQuota() {
        consumeQuotaCalled = true;
        return null;
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/extension/api-key/check",
      headers: {
        "x-api-key": "test-key",
      },
      payload: {
        user_id: extensionUserId,
      },
    });
    const payload = response.json();

    assert.equal(response.statusCode, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.message, "API key is valid and has remaining quota.");
    assert.equal(payload.diagnostics.apiKeyId, apiKeyId);
    assert.equal(payload.diagnostics.quotaRemaining, 7);
    assert.equal(ensureUserCalled, false);
    assert.equal(consumeQuotaCalled, false);
  } finally {
    await app.close();
  }
});

await runCase("POST /v1/extension/api-key/check returns informative auth failures", async () => {
  const app = buildApiApp({
    services: createExtensionServices({
      async resolveExtensionApiKey() {
        return null;
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/extension/api-key/check",
      headers: {
        "x-api-key": "bad-key",
      },
      payload: {
        user_id: extensionUserId,
      },
    });
    const payload = response.json();

    assert.equal(response.statusCode, 401);
    assert.equal(payload.error, "invalid_api_key");
    assert.equal(payload.message, "The provided API key was not found.");
  } finally {
    await app.close();
  }
});

await runCase("POST /v1/extension/review-response rejects invalid request bodies", async () => {
  let apiKeyResolved = false;
  const app = buildApiApp({
    services: createExtensionServices({
      async resolveExtensionApiKey() {
        apiKeyResolved = true;
        return null;
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/extension/review-response",
      headers: {
        "x-api-key": "test-key",
      },
      payload: {
        user_id: "not-a-uuid",
        review: {},
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "invalid_extension_request");
    assert.equal(apiKeyResolved, false);
  } finally {
    await app.close();
  }
});

await runCase("POST /v1/extension/review-response rejects exhausted quota before user creation", async () => {
  let ensureUserCalled = false;
  const errors = [];
  const app = buildApiApp({
    services: createExtensionServices({
      async resolveExtensionApiKey() {
        return {
          id: apiKeyId,
          label: "Exhausted key",
          quotaTotal: 5,
          quotaUsed: 5,
          quotaRemaining: 0,
          invalidatedAt: null,
        };
      },
      async ensureExtensionUser() {
        ensureUserCalled = true;
        return null;
      },
      async recordExtensionError(input) {
        errors.push(input);
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/extension/review-response",
      headers: {
        "x-api-key": "test-key",
      },
      payload: {
        user_id: extensionUserId,
        review: parsedReview,
      },
    });

    assert.equal(response.statusCode, 402);
    assert.equal(response.json().error, "api_key_quota_exhausted");
    assert.equal(response.json().details.quota_remaining, 0);
    assert.equal(ensureUserCalled, false);
    assert.equal(errors[0].errorCode, "api_key_quota_exhausted");
    assert.equal(errors[0].apiKeyId, apiKeyId);
  } finally {
    await app.close();
  }
});

await runCase("POST /v1/extension/review-response calls the active provider and consumes quota on success", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const providerCalls = [];
  globalThis.fetch = async (url, init) => {
    providerCalls.push({ url: url.toString(), body: JSON.parse(init.body), headers: init.headers });
    return Response.json({
      choices: [{ message: { content: "Спасибо за отзыв. Нам жаль, что товар не подошел." } }],
    });
  };
  const app = buildApiApp({
    services: createExtensionServices({
      async createExtensionGenerationRequest(input) {
        calls.push(["createRequest", input]);
        return {
          id: requestId,
          apiKeyId,
          extensionUserId,
          status: "received",
          quotaConsumed: false,
        };
      },
      async recordExtensionGenerationEvent(input) {
        calls.push(["event", input]);
      },
      async ensureExtensionUser(input) {
        calls.push(["ensureUser", input]);
        return {
          id: input.userId,
          email: `${input.userId}@extension.com`,
          created: true,
        };
      },
      async consumeExtensionApiQuota(input) {
        calls.push(["consumeQuota", input]);
        return {
          apiKeyId,
          quotaTotal: 10,
          quotaUsed: 4,
          quotaRemaining: 6,
        };
      },
      async updateExtensionGenerationRequest(input) {
        calls.push(["updateRequest", input]);
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/extension/review-response",
      headers: {
        "x-api-key": "test-key",
      },
      payload: {
        user_id: extensionUserId,
        review: parsedReviewWithoutOptionalCharacteristics,
      },
    });

    const payload = response.json();

    assert.equal(response.statusCode, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.response.text, "Спасибо за отзыв. Нам жаль, что товар не подошел.");
    assert.equal(payload.response.diagnostics.backend, "fastify");
    assert.equal(payload.response.diagnostics.mode, "provider");
    assert.equal(payload.response.diagnostics.requestId, requestId);
    assert.equal(payload.response.diagnostics.quotaRemaining, 6);
    assert.equal(payload.response.diagnostics.providerProfileId, providerProfileId);
    assert.equal(payload.response.diagnostics.promptProfileId, promptProfileId);
    assert.equal(payload.response.diagnostics.model, "test-model");
    assert.equal(providerCalls[0].url, "https://api.provider.example/v1/chat/completions");
    assert.equal(providerCalls[0].headers.authorization, "Bearer provider-secret");
    assert.equal(providerCalls[0].body.model, "test-model");
    assert.equal(providerCalls[0].body.temperature, 0.4);
    assert.equal(providerCalls[0].body.max_tokens, 750);
    assert.deepEqual(providerCalls[0].body.provider, {
      order: ["name1", "name2"],
      allow_fallbacks: true,
    });
    assert.equal(providerCalls[0].body.messages[0].content, "Reply in Russian.");
    assert.match(providerCalls[0].body.messages[1].content, /Product: Парные худи/);
    assert.deepEqual(
      calls
        .filter(([name]) => name === "event")
        .map(([, event]) => event.eventType),
      [
        "request_received",
        "api_key_validated",
        "user_created",
        "prompt_rendered",
        "ai_generation_started",
        "ai_generation_succeeded",
        "quota_consumed",
      ],
    );
    assert.equal(
      calls.find(([name]) => name === "createRequest")[1].requestPayload.review.colors,
      "",
    );
    assert.equal(
      calls.find(([name]) => name === "createRequest")[1].requestPayload.review.size,
      "",
    );
    const promptRenderedEvent = calls
      .filter(([name]) => name === "event")
      .map(([, event]) => event)
      .find((event) => event.eventType === "prompt_rendered");
    assert.equal(promptRenderedEvent.details.prompt_profile_id, promptProfileId);
    assert.equal(promptRenderedEvent.details.product_details_count, 3);
    assert.deepEqual(promptRenderedEvent.details.product_details_preview, parsedReview.product_details);
    assert.match(promptRenderedEvent.details.rendered_prompt_preview, /Product: Парные худи/);
    assert.equal(
      calls.some(([name]) => name === "consumeQuota"),
      true,
    );
    assert.deepEqual(
      calls.find(([name]) => name === "consumeQuota")[1],
      {
        apiKeyId,
        requestId,
        amount: 1,
        reason: "review_response_ai_succeeded",
      },
    );
    assert.equal(
      calls.some(([name]) => name === "updateRequest"),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
  }
});

await runCase("POST /v1/extension/review-response rejects missing active provider without consuming quota", async () => {
  let consumeQuotaCalled = false;
  const errors = [];
  const app = buildApiApp({
    services: createExtensionServices({
      async getActiveAiProviderProfileSecret() {
        return null;
      },
      async consumeExtensionApiQuota() {
        consumeQuotaCalled = true;
        return null;
      },
      async recordExtensionError(input) {
        errors.push(input);
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/extension/review-response",
      headers: {
        "x-api-key": "test-key",
      },
      payload: {
        user_id: extensionUserId,
        review: parsedReview,
      },
    });
    const payload = response.json();

    assert.equal(response.statusCode, 503);
    assert.equal(payload.error, "active_ai_provider_profile_missing");
    assert.equal(payload.message, "No active AI provider profile is configured.");
    assert.equal(consumeQuotaCalled, false);
    assert.equal(errors[0].errorCode, "active_ai_provider_profile_missing");
  } finally {
    await app.close();
  }
});

await runCase("POST /v1/extension/review-response rejects review payloads outside the modal schema", async () => {
  let apiKeyResolved = false;
  const app = buildApiApp({
    services: createExtensionServices({
      async resolveExtensionApiKey() {
        apiKeyResolved = true;
        return null;
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/extension/review-response",
      headers: {
        "x-api-key": "test-key",
      },
      payload: {
        user_id: extensionUserId,
        review: {
          ...parsedReview,
          rating: 6,
        },
      },
    });

    const payload = response.json();

    assert.equal(response.statusCode, 400);
    assert.equal(payload.error, "invalid_extension_request");
    assert.equal(
      payload.details.issues.some((issue) => issue.path === "review.rating"),
      true,
    );
    assert.equal(apiKeyResolved, false);
  } finally {
    await app.close();
  }
});
