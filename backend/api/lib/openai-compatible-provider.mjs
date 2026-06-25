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

async function readJsonResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.message ??
      `Provider request failed with HTTP ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

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
}) {
  const response = await fetchImplementation(joinProviderUrl(baseUrl, "/models"), {
    method: "GET",
    headers: createProviderHeaders(apiKey),
  });
  const payload = await readJsonResponse(response);
  const modelData = Array.isArray(payload?.data) ? payload.data : [];

  return modelData
    .map((model) => ({ id: typeof model?.id === "string" ? model.id : "" }))
    .filter((model) => model.id);
}

export async function checkOpenAiCompatibleChat({
  baseUrl,
  apiKey,
  model,
  fetchImplementation = globalThis.fetch,
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
    temperature: 1,
    maxTokens: 16,
    fetchImplementation,
  });
}

export async function createOpenAiCompatibleChatCompletion({
  baseUrl,
  apiKey,
  model,
  messages,
  temperature = 1,
  maxTokens,
  fetchImplementation = globalThis.fetch,
}) {
  const requestPayload = {
    model,
    messages,
    temperature,
  };

  if (Number.isInteger(maxTokens) && maxTokens > 0) {
    requestPayload.max_tokens = maxTokens;
  }

  const response = await fetchImplementation(joinProviderUrl(baseUrl, "/chat/completions"), {
    method: "POST",
    headers: createProviderHeaders(apiKey),
    body: JSON.stringify(requestPayload),
  });
  const payload = await readJsonResponse(response);

  return extractChatCompletionText(payload);
}
