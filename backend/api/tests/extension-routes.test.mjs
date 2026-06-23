import assert from "node:assert/strict";

import { buildApiApp } from "../app.mjs";
import { createServices, runCase } from "./helpers/route-test-helpers.mjs";

const extensionUserId = "c2a5f455-c2a5-7338-9883-02f3edc500a7";
const apiKeyId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";

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
        review: {},
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
        review: {},
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

await runCase("POST /v1/extension/review-response returns stub response and consumes quota on success", async () => {
  const calls = [];
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
        calls.push(["event", input.eventType]);
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
        review: {
          rating: 1,
          comment: "bad quality",
        },
      },
    });

    const payload = response.json();

    assert.equal(response.statusCode, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.response.diagnostics.backend, "fastify");
    assert.equal(payload.response.diagnostics.mode, "stub");
    assert.equal(payload.response.diagnostics.requestId, requestId);
    assert.equal(payload.response.diagnostics.quotaRemaining, 6);
    assert.deepEqual(
      calls
        .filter(([name]) => name === "event")
        .map(([, eventType]) => eventType),
      [
        "request_received",
        "api_key_validated",
        "user_created",
        "ai_generation_started",
        "ai_generation_succeeded",
        "quota_consumed",
      ],
    );
    assert.equal(
      calls.some(([name]) => name === "consumeQuota"),
      true,
    );
    assert.equal(
      calls.some(([name]) => name === "updateRequest"),
      true,
    );
  } finally {
    await app.close();
  }
});
