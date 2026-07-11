import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createOpenAiCompatibleChatCompletion,
  listOpenAiCompatibleModels,
} from "../lib/openai-compatible-provider.mjs";
import { runCase } from "./helpers/test-helpers.mjs";

const baseInput = {
  baseUrl: "https://provider.example/v1",
  apiKey: "provider-secret",
  model: "test-model",
  messages: [{ role: "user", content: "Hi" }],
};

function createCompletionResponse(content = "Hello") {
  return Response.json({
    choices: [{ message: { content } }],
  });
}

await runCase("chat completion builds default fallback and only-one provider payloads", async () => {
  const bodies = [];
  const fetchImplementation = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return createCompletionResponse();
  };

  await createOpenAiCompatibleChatCompletion({
    ...baseInput,
    fetchImplementation,
  });
  await createOpenAiCompatibleChatCompletion({
    ...baseInput,
    temperature: 0.5,
    maxTokens: 700,
    providerRouting: { mode: "fallback", order: ["name1", "name2"] },
    fetchImplementation,
  });
  await createOpenAiCompatibleChatCompletion({
    ...baseInput,
    providerRouting: { mode: "only-one", only: "name1" },
    fetchImplementation,
  });

  assert.equal(bodies[0].temperature, 1);
  assert.equal(bodies[0].max_tokens, 500);
  assert.equal("provider" in bodies[0], false);
  assert.deepEqual(bodies[1].provider, {
    order: ["name1", "name2"],
    allow_fallbacks: true,
  });
  assert.equal(bodies[1].temperature, 0.5);
  assert.equal(bodies[1].max_tokens, 700);
  assert.deepEqual(bodies[2].provider, { only: ["name1"] });
});

await runCase("provider calls write paired formatted JSON logs without API keys", async () => {
  const previousLogDirectory = process.env.WB_AI_HELPER_LOG_DIR;
  const logDirectory = await mkdtemp(path.join(os.tmpdir(), "wb-provider-logs-"));
  process.env.WB_AI_HELPER_LOG_DIR = logDirectory;

  try {
    const models = await listOpenAiCompatibleModels({
      baseUrl: baseInput.baseUrl,
      apiKey: baseInput.apiKey,
      logContext: {
        providerProfileId: "profile-1",
        correlationId: "request-1",
      },
      fetchImplementation: async () => Response.json({ data: [{ id: "test-model" }] }),
    });

    assert.deepEqual(models, [{ id: "test-model" }]);
    const files = (await readdir(path.join(logDirectory, "openai"))).sort();
    assert.equal(files.length, 2);
    assert.match(files[0], /model-list_request-1_.*\.request\.json$/);
    assert.equal(files[1], files[0].replace(".request.json", ".response.json"));

    const requestText = await readFile(path.join(logDirectory, "openai", files[0]), "utf8");
    const responseText = await readFile(path.join(logDirectory, "openai", files[1]), "utf8");
    const requestPayload = JSON.parse(requestText);
    const responsePayload = JSON.parse(responseText);

    assert.equal(requestPayload.method, "GET");
    assert.equal(requestPayload.url, "https://provider.example/v1/models");
    assert.equal(requestPayload.body, null);
    assert.equal(responsePayload.requestFile, files[0]);
    assert.equal(responsePayload.status, 200);
    assert.equal(responsePayload.ok, true);
    assert.equal(requestText.includes(baseInput.apiKey), false);
    assert.equal(responseText.includes(baseInput.apiKey), false);
    assert.match(requestText, /\n  "callId"/);
  } finally {
    if (previousLogDirectory === undefined) {
      delete process.env.WB_AI_HELPER_LOG_DIR;
    } else {
      process.env.WB_AI_HELPER_LOG_DIR = previousLogDirectory;
    }
    await rm(logDirectory, { recursive: true, force: true });
  }
});

await runCase("provider network errors write a paired error response log", async () => {
  const previousLogDirectory = process.env.WB_AI_HELPER_LOG_DIR;
  const logDirectory = await mkdtemp(path.join(os.tmpdir(), "wb-provider-error-logs-"));
  process.env.WB_AI_HELPER_LOG_DIR = logDirectory;

  try {
    await assert.rejects(
      createOpenAiCompatibleChatCompletion({
        ...baseInput,
        logContext: {
          operation: "extension-generation",
          correlationId: "generation-1",
        },
        fetchImplementation: async () => {
          const error = new Error("connection refused");
          error.code = "ECONNREFUSED";
          throw error;
        },
      }),
      /connection refused/,
    );

    const files = (await readdir(path.join(logDirectory, "openai"))).sort();
    assert.equal(files.length, 2);
    const responseFile = files.find((file) => file.endsWith(".response.json"));
    const responsePayload = JSON.parse(
      await readFile(path.join(logDirectory, "openai", responseFile), "utf8"),
    );
    assert.equal(responsePayload.status, null);
    assert.equal(responsePayload.ok, false);
    assert.equal(responsePayload.error.code, "ECONNREFUSED");
  } finally {
    if (previousLogDirectory === undefined) {
      delete process.env.WB_AI_HELPER_LOG_DIR;
    } else {
      process.env.WB_AI_HELPER_LOG_DIR = previousLogDirectory;
    }
    await rm(logDirectory, { recursive: true, force: true });
  }
});

await runCase("provider HTTP and malformed responses preserve diagnostic response bodies", async () => {
  const previousLogDirectory = process.env.WB_AI_HELPER_LOG_DIR;
  const logDirectory = await mkdtemp(path.join(os.tmpdir(), "wb-provider-response-logs-"));
  process.env.WB_AI_HELPER_LOG_DIR = logDirectory;

  try {
    await assert.rejects(
      createOpenAiCompatibleChatCompletion({
        ...baseInput,
        logContext: { correlationId: "http-error" },
        fetchImplementation: async () => Response.json(
          { error: { message: "rate limited" } },
          { status: 429 },
        ),
      }),
      /rate limited/,
    );
    await assert.rejects(
      createOpenAiCompatibleChatCompletion({
        ...baseInput,
        logContext: { correlationId: "malformed-response" },
        fetchImplementation: async () => new Response("not-json"),
      }),
      /did not include message content/,
    );

    const outputDirectory = path.join(logDirectory, "openai");
    const files = await readdir(outputDirectory);
    const httpErrorFile = files.find(
      (file) => file.includes("http-error") && file.endsWith(".response.json"),
    );
    const malformedFile = files.find(
      (file) => file.includes("malformed-response") && file.endsWith(".response.json"),
    );
    const httpErrorPayload = JSON.parse(
      await readFile(path.join(outputDirectory, httpErrorFile), "utf8"),
    );
    const malformedPayload = JSON.parse(
      await readFile(path.join(outputDirectory, malformedFile), "utf8"),
    );

    assert.equal(httpErrorPayload.status, 429);
    assert.equal(httpErrorPayload.ok, false);
    assert.equal(httpErrorPayload.body.error.message, "rate limited");
    assert.equal(httpErrorPayload.error.message, "rate limited");
    assert.equal(malformedPayload.status, 200);
    assert.equal(malformedPayload.body, null);
    assert.equal(malformedPayload.rawBody, "not-json");
  } finally {
    if (previousLogDirectory === undefined) {
      delete process.env.WB_AI_HELPER_LOG_DIR;
    } else {
      process.env.WB_AI_HELPER_LOG_DIR = previousLogDirectory;
    }
    await rm(logDirectory, { recursive: true, force: true });
  }
});
