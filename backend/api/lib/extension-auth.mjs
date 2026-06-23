function getApiKey(headerValue) {
  if (Array.isArray(headerValue)) {
    return headerValue[0]?.trim() ?? "";
  }

  return typeof headerValue === "string" ? headerValue.trim() : "";
}

export async function resolveExtensionApiKeyRequest(request, reply) {
  const apiKey = getApiKey(request.headers["x-api-key"]);

  if (!apiKey) {
    const payload = {
      error: "api_key_required",
      message: "Provide an API key in the x-api-key header.",
    };

    return {
      ok: false,
      statusCode: 401,
      errorCode: payload.error,
      errorMessage: payload.message,
      apiKeyId: null,
      response: reply.code(401).send(payload),
    };
  }

  const apiKeyRecord = await request.server.services.resolveExtensionApiKey({
    apiKey,
  });

  if (!apiKeyRecord) {
    const payload = {
      error: "invalid_api_key",
      message: "The provided API key was not found.",
    };

    return {
      ok: false,
      statusCode: 401,
      errorCode: payload.error,
      errorMessage: payload.message,
      apiKeyId: null,
      response: reply.code(401).send(payload),
    };
  }

  if (apiKeyRecord.invalidatedAt) {
    const payload = {
      error: "api_key_invalidated",
      message: "The provided API key has been invalidated.",
      details: {
        invalidated_at: apiKeyRecord.invalidatedAt,
      },
    };

    return {
      ok: false,
      statusCode: 403,
      errorCode: payload.error,
      errorMessage: payload.message,
      apiKeyId: apiKeyRecord.id,
      response: reply.code(403).send(payload),
    };
  }

  if (apiKeyRecord.quotaRemaining <= 0) {
    const payload = {
      error: "api_key_quota_exhausted",
      message: "The provided API key has no remaining quota.",
      details: {
        quota_total: apiKeyRecord.quotaTotal,
        quota_used: apiKeyRecord.quotaUsed,
        quota_remaining: 0,
      },
    };

    return {
      ok: false,
      statusCode: 402,
      errorCode: payload.error,
      errorMessage: payload.message,
      apiKeyId: apiKeyRecord.id,
      response: reply.code(402).send(payload),
    };
  }

  return {
    ok: true,
    apiKey,
    apiKeyRecord,
  };
}
