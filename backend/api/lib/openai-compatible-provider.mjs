import { createProviderJsonLogger } from "./provider-json-logger.mjs";

function joinProviderUrl(baseUrl, path) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\/+/, ""), normalizedBase);
}

function createProviderHeaders(apiKey) {
  return {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  };
}

async function requestOpenAiCompatibleJson({
  url,
  method,
  apiKey,
  body,
  logContext,
  fetchImplementation,
}) {
  const providerLogger = createProviderJsonLogger(logContext);
  await providerLogger.writeRequest({ method, url, body });

  let response;

  try {
    response = await fetchImplementation(url, {
      method,
      headers: createProviderHeaders(apiKey),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    await providerLogger.writeResponse({ error });
    throw error;
  }

  let rawBody;

  try {
    rawBody = await response.text();
  } catch (error) {
    await providerLogger.writeResponse({
      status: response.status,
      ok: false,
      error,
    });
    throw error;
  }
  let payload = null;

  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {}

  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.message ??
      `Provider request failed with HTTP ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    await providerLogger.writeResponse({
      status: response.status,
      ok: false,
      body: payload,
      ...(payload === null && rawBody ? { rawBody } : {}),
      error,
    });
    throw error;
  }

  await providerLogger.writeResponse({
    status: response.status,
    ok: true,
    body: payload,
    ...(payload === null && rawBody ? { rawBody } : {}),
  });

  return payload;
}

function extractChatCompletionText(payload) {
  const responseText = payload?.choices?.[0]?.message?.content;

  if (typeof responseText !== "string") {
    const error = new Error("Provider chat completion response did not include message content.");
    error.code = "provider_response_invalid";
    error.payload = payload;
    throw error;
  }

  return responseText.trim();
}

export async function listOpenAiCompatibleModels({
  baseUrl,
  apiKey,
  fetchImplementation = globalThis.fetch,
  logContext,
}) {
  const payload = await requestOpenAiCompatibleJson({
    url: joinProviderUrl(baseUrl, "/models"),
    method: "GET",
    apiKey,
    logContext: {
      operation: "model-list",
      ...logContext,
    },
    fetchImplementation,
  });
  const modelData = Array.isArray(payload?.data) ? payload.data : [];

  return modelData
    .map((model) => ({ id: typeof model?.id === "string" ? model.id : "" }))
    .filter((model) => model.id);
}

export async function checkOpenAiCompatibleChat({
  baseUrl,
  apiKey,
  model,
  temperature = 1,
  maxTokens = 2000,
  maxCompletionTokens = 2000,
  providerRouting = { mode: "default" },
  fetchImplementation = globalThis.fetch,
  logContext,
}) {
  return createOpenAiCompatibleChatCompletion({
    baseUrl,
    apiKey,
    model,
    messages: [
      {
        role: "system",
        content: "You are a concise connectivity checker.",
      },
      {
        role: "user",
        content: "Reply with exactly: ok",
      },
    ],
    temperature,
    maxTokens,
    maxCompletionTokens,
    providerRouting,
    fetchImplementation,
    logContext: {
      operation: "provider-check",
      ...logContext,
    },
  });
}

export async function createOpenAiCompatibleChatCompletion({
  baseUrl,
  apiKey,
  model,
  messages,
  temperature = 1,
  maxTokens = 2000,
  maxCompletionTokens = 2000,
  providerRouting = { mode: "default" },
  fetchImplementation = globalThis.fetch,
  logContext,
}) {
  const requestPayload = {
    model,
    messages,
    temperature,
  };

  if (Number.isInteger(maxTokens) && maxTokens > 0) {
    requestPayload.max_tokens = maxTokens;
  }

  if (Number.isInteger(maxCompletionTokens) && maxCompletionTokens > 0) {
    requestPayload.max_completion_tokens = maxCompletionTokens;
  }

  if (providerRouting.mode === "fallback") {
    requestPayload.provider = {
      order: providerRouting.order,
      allow_fallbacks: true,
    };
  } else if (providerRouting.mode === "only-one") {
    requestPayload.provider = {
      only: [providerRouting.only],
    };
  }

  const payload = await requestOpenAiCompatibleJson({
    url: joinProviderUrl(baseUrl, "/chat/completions"),
    method: "POST",
    apiKey,
    body: requestPayload,
    logContext: {
      operation: "chat-completion",
      ...logContext,
    },
    fetchImplementation,
  });

  return extractChatCompletionText(payload);
}
