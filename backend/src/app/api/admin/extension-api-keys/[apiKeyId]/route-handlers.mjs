import {
  adminExtensionApiKeyDetailResponseSchema,
  adminExtensionApiKeyErrorResponseSchema,
  adjustAdminExtensionApiKeyQuotaRequestSchema,
  adjustAdminExtensionApiKeyQuotaResponseSchema,
  invalidateAdminExtensionApiKeyRequestSchema,
  invalidateAdminExtensionApiKeyResponseSchema,
} from "../../../../../shared/api/admin-extension-api-keys.mjs";
import {
  createBearerAuthorizationHeaders,
  createInvalidSessionResponse,
  forwardJsonResponse,
  jsonResponse,
} from "../../../../../core/api/next-proxy-helpers.mjs";

function createForwardedError({ payload, status, fallbackError, fallbackMessage }) {
  const parsedError = adminExtensionApiKeyErrorResponseSchema.safeParse(payload);

  return jsonResponse(
    parsedError.success
      ? parsedError.data
      : {
          error: fallbackError,
          message: fallbackMessage,
        },
    { status },
  );
}

export function createAdminExtensionApiKeyDetailRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation = globalThis.fetch,
}) {
  async function GET(_request, { params }) {
    const authorizationHeaders = await createBearerAuthorizationHeaders(createSupabaseServerClient);

    if (!authorizationHeaders) {
      return createInvalidSessionResponse();
    }

    const { apiKeyId } = await params;
    const upstream = await fetchImplementation(
      `${getInternalApiUrl()}/v1/admin/extension-api-keys/${encodeURIComponent(apiKeyId)}`,
      {
        method: "GET",
        headers: authorizationHeaders,
        cache: "no-store",
      },
    );
    const { ok, status, payload } = await forwardJsonResponse(upstream);

    if (!ok) {
      return createForwardedError({
        payload,
        status,
        fallbackError: "admin_extension_api_key_list_failed",
        fallbackMessage: "The admin extension API key detail request failed.",
      });
    }

    const parsedResponse = adminExtensionApiKeyDetailResponseSchema.safeParse(payload);

    if (!parsedResponse.success) {
      return jsonResponse(
        {
          error: "admin_extension_api_key_list_failed",
          message: "The admin extension API key detail response was invalid.",
        },
        { status: 502 },
      );
    }

    return jsonResponse(parsedResponse.data);
  }

  return {
    GET,
  };
}

export function createAdminExtensionApiKeyQuotaRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation = globalThis.fetch,
}) {
  async function POST(request, { params }) {
    const authorizationHeaders = await createBearerAuthorizationHeaders(createSupabaseServerClient);

    if (!authorizationHeaders) {
      return createInvalidSessionResponse();
    }

    const { apiKeyId } = await params;
    const requestPayload = adjustAdminExtensionApiKeyQuotaRequestSchema.parse(
      await request.json().catch(() => ({})),
    );
    const upstream = await fetchImplementation(
      `${getInternalApiUrl()}/v1/admin/extension-api-keys/${encodeURIComponent(apiKeyId)}/quota-events`,
      {
        method: "POST",
        headers: {
          ...authorizationHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify(requestPayload),
        cache: "no-store",
      },
    );
    const { ok, status, payload } = await forwardJsonResponse(upstream);

    if (!ok) {
      return createForwardedError({
        payload,
        status,
        fallbackError: "admin_extension_api_key_update_failed",
        fallbackMessage: "The admin extension API key quota update request failed.",
      });
    }

    const parsedResponse = adjustAdminExtensionApiKeyQuotaResponseSchema.safeParse(payload);

    if (!parsedResponse.success) {
      return jsonResponse(
        {
          error: "admin_extension_api_key_update_failed",
          message: "The admin extension API key quota update response was invalid.",
        },
        { status: 502 },
      );
    }

    return jsonResponse(parsedResponse.data);
  }

  return {
    POST,
  };
}

export function createAdminExtensionApiKeyInvalidateRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation = globalThis.fetch,
}) {
  async function POST(request, { params }) {
    const authorizationHeaders = await createBearerAuthorizationHeaders(createSupabaseServerClient);

    if (!authorizationHeaders) {
      return createInvalidSessionResponse();
    }

    const { apiKeyId } = await params;
    const requestPayload = invalidateAdminExtensionApiKeyRequestSchema.parse(
      await request.json().catch(() => ({})),
    );
    const upstream = await fetchImplementation(
      `${getInternalApiUrl()}/v1/admin/extension-api-keys/${encodeURIComponent(apiKeyId)}/invalidate`,
      {
        method: "POST",
        headers: {
          ...authorizationHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify(requestPayload),
        cache: "no-store",
      },
    );
    const { ok, status, payload } = await forwardJsonResponse(upstream);

    if (!ok) {
      return createForwardedError({
        payload,
        status,
        fallbackError: "admin_extension_api_key_update_failed",
        fallbackMessage: "The admin extension API key invalidation request failed.",
      });
    }

    const parsedResponse = invalidateAdminExtensionApiKeyResponseSchema.safeParse(payload);

    if (!parsedResponse.success) {
      return jsonResponse(
        {
          error: "admin_extension_api_key_update_failed",
          message: "The admin extension API key invalidation response was invalid.",
        },
        { status: 502 },
      );
    }

    return jsonResponse(parsedResponse.data);
  }

  return {
    POST,
  };
}
