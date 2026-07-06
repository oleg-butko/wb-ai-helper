import assert from "node:assert/strict";
import { runCase } from "./helpers/test-helpers.mjs";

import { buildApiApp } from "../app.mjs";
import { createQueueService } from "../core/queue/service.mjs";
import {
  defaultProductDetailsTemplate,
  defaultPromptExamplePayload,
  defaultSystemPrompt,
} from "../../src/shared/api/admin-ai-prompt-profiles.mjs";

const profileId = "44444444-4444-4444-8444-444444444444";
const adminUserId = "user-123";

function createProfile(overrides = {}) {
  return {
    id: profileId,
    label: "Default review response prompt",
    systemPrompt: defaultSystemPrompt,
    productDetailsTemplate: defaultProductDetailsTemplate,
    examplePayload: defaultPromptExamplePayload,
    isActive: true,
    isDefault: false,
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
    async listAdminAiPromptProfiles() {
      return [createProfile()];
    },
    async createAdminAiPromptProfile(input) {
      return createProfile({
        label: input.label,
        systemPrompt: input.systemPrompt,
        productDetailsTemplate: input.productDetailsTemplate,
        examplePayload: input.examplePayload,
        isActive: false,
      });
    },
    async getAdminAiPromptProfile() {
      return createProfile();
    },
    async updateAdminAiPromptProfile(input) {
      return createProfile({
        label: input.label ?? "Default review response prompt",
        systemPrompt: input.systemPrompt ?? defaultSystemPrompt,
        productDetailsTemplate: input.productDetailsTemplate ?? defaultProductDetailsTemplate,
        examplePayload: input.examplePayload ?? defaultPromptExamplePayload,
      });
    },
    async activateAdminAiPromptProfile() {
      return createProfile({ isActive: true });
    },
    ...createQueueService(),
    ...overrides,
  };
}

await runCase("admin AI prompt routes reject requests without authorization", async () => {
  const app = buildApiApp({
    services: createServices(),
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/ai-prompt-profiles",
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "authorization_required");
  } finally {
    await app.close();
  }
});

await runCase("admin AI prompt routes require an admin database row", async () => {
  let serviceCalled = false;
  const app = buildApiApp({
    services: createServices({
      async isAppAdminEmail() {
        return false;
      },
      async listAdminAiPromptProfiles() {
        serviceCalled = true;
        return [];
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/ai-prompt-profiles",
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

await runCase("POST /v1/admin/ai-prompt-profiles creates a prompt profile", async () => {
  const calls = [];
  const app = buildApiApp({
    services: createServices({
      async createAdminAiPromptProfile(input) {
        calls.push(input);
        return createProfile({ label: input.label, isActive: false });
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/ai-prompt-profiles",
      headers: {
        authorization: "Bearer valid-token",
      },
      payload: {
        label: "Prompt v2",
        systemPrompt: defaultSystemPrompt,
        productDetailsTemplate: defaultProductDetailsTemplate,
        examplePayload: defaultPromptExamplePayload,
      },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().profile.label, "Prompt v2");
    assert.equal(response.json().profile.isActive, false);
    assert.equal(calls[0].adminUserId, adminUserId);
  } finally {
    await app.close();
  }
});

await runCase("POST /v1/admin/ai-prompt-profiles rejects duplicate labels", async () => {
  const app = buildApiApp({
    services: createServices({
      async createAdminAiPromptProfile() {
        const error = new Error("An AI prompt profile with this label already exists.");
        error.code = "admin_ai_prompt_profile_label_conflict";
        throw error;
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/ai-prompt-profiles",
      headers: {
        authorization: "Bearer valid-token",
      },
      payload: {
        label: "Default review response prompt",
        systemPrompt: defaultSystemPrompt,
        productDetailsTemplate: defaultProductDetailsTemplate,
        examplePayload: defaultPromptExamplePayload,
      },
    });
    const payload = response.json();

    assert.equal(response.statusCode, 409);
    assert.equal(payload.error, "admin_ai_prompt_profile_label_conflict");
    assert.equal(payload.message, "An AI prompt profile with this label already exists.");
  } finally {
    await app.close();
  }
});

await runCase("POST /v1/admin/ai-prompt-profiles/:profileId/preview renders the template", async () => {
  const app = buildApiApp({
    services: createServices(),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/ai-prompt-profiles/${profileId}/preview`,
      headers: {
        authorization: "Bearer valid-token",
      },
      payload: {
        productDetailsTemplate: "Product: {{product_name}}\nDetails:\n{{product_details}}",
        examplePayload: defaultPromptExamplePayload,
      },
    });
    const payload = response.json();

    assert.equal(response.statusCode, 200);
    assert.equal(payload.profileId, profileId);
    assert.match(payload.productDetailsPrompt, /Product: Парные худи/);
    assert.match(payload.productDetailsPrompt, /- Покупка: 10\.06\.2026/);
  } finally {
    await app.close();
  }
});

await runCase("POST /v1/admin/ai-prompt-profiles/:profileId/preview rejects unknown placeholders", async () => {
  const app = buildApiApp({
    services: createServices(),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/ai-prompt-profiles/${profileId}/preview`,
      headers: {
        authorization: "Bearer valid-token",
      },
      payload: {
        productDetailsTemplate: "Unknown: {{missing_field}}",
      },
    });
    const payload = response.json();

    assert.equal(response.statusCode, 400);
    assert.equal(payload.error, "admin_ai_prompt_profile_unknown_placeholders");
    assert.deepEqual(payload.details.unknownPlaceholders, ["missing_field"]);
  } finally {
    await app.close();
  }
});

await runCase("POST /v1/admin/ai-prompt-profiles/:profileId/activate activates a profile", async () => {
  const calls = [];
  const app = buildApiApp({
    services: createServices({
      async activateAdminAiPromptProfile(input) {
        calls.push(input);
        return createProfile({ isActive: true });
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/ai-prompt-profiles/${profileId}/activate`,
      headers: {
        authorization: "Bearer valid-token",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().profile.isActive, true);
    assert.deepEqual(calls, [{ profileId, adminUserId }]);
  } finally {
    await app.close();
  }
});
