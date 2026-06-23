import {
  adminExtensionApiKeyErrorResponseSchema,
  adminExtensionApiKeyListResponseSchema,
  createAdminExtensionApiKeyRequestSchema,
  createAdminExtensionApiKeyResponseSchema,
  findAdminExtensionApiKeyRequestSchema,
  findAdminExtensionApiKeyResponseSchema,
} from "../../../../shared/api/admin-extension-api-keys.mjs";
import {
  createBearerAuthorizationHeaders,
  createInvalidSessionResponse,
  forwardJsonResponse,
  jsonResponse,
} from "../../../../core/api/next-proxy-helpers.mjs";

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

export function createAdminExtensionApiKeysRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation = globalThis.fetch,
}) {
  async function GET(request) {
    const authorizationHeaders = await createBearerAuthorizationHeaders(createSupabaseServerClient);

    if (!authorizationHeaders) {
      return createInvalidSessionResponse();
    }

    const upstreamUrl = new URL(`${getInternalApiUrl()}/v1/admin/extension-api-keys`);
    const limit = new URL(request.url).searchParams.get("limit");

    if (limit) {
      upstreamUrl.searchParams.set("limit", limit);
    }

    const upstream = await fetchImplementation(upstreamUrl, {
      method: "GET",
      headers: authorizationHeaders,
      cache: "no-store",
    });
    const { ok, status, payload } = await forwardJsonResponse(upstream);

    if (!ok) {
      return createForwardedError({
        payload,
        status,
        fallbackError: "admin_extension_api_key_list_failed",
        fallbackMessage: "The admin extension API key list request failed.",
      });
    }

    const parsedResponse = adminExtensionApiKeyListResponseSchema.safeParse(payload);

    if (!parsedResponse.success) {
      return jsonResponse(
        {
          error: "admin_extension_api_key_list_failed",
          message: "The admin extension API key list response was invalid.",
        },
        { status: 502 },
      );
    }

    return jsonResponse(parsedResponse.data);
  }

  async function POST(request) {
    const authorizationHeaders = await createBearerAuthorizationHeaders(createSupabaseServerClient);

    if (!authorizationHeaders) {
      return createInvalidSessionResponse();
    }

    const requestPayload = createAdminExtensionApiKeyRequestSchema.parse(
      await request.json().catch(() => ({})),
    );
    const upstream = await fetchImplementation(`${getInternalApiUrl()}/v1/admin/extension-api-keys`, {
      method: "POST",
      headers: {
        ...authorizationHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestPayload),
      cache: "no-store",
    });
    const { ok, status, payload } = await forwardJsonResponse(upstream);

    if (!ok) {
      return createForwardedError({
        payload,
        status,
        fallbackError: "admin_extension_api_key_create_failed",
        fallbackMessage: "The admin extension API key create request failed.",
      });
    }

    const parsedResponse = createAdminExtensionApiKeyResponseSchema.safeParse(payload);

    if (!parsedResponse.success) {
      return jsonResponse(
        {
          error: "admin_extension_api_key_create_failed",
          message: "The admin extension API key create response was invalid.",
        },
        { status: 502 },
      );
    }

    return jsonResponse(parsedResponse.data, { status: 201 });
  }

  return {
    GET,
    POST,
  };
}

export function createAdminExtensionApiKeyFindRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation = globalThis.fetch,
}) {
  async function POST(request) {
    const authorizationHeaders = await createBearerAuthorizationHeaders(createSupabaseServerClient);

    if (!authorizationHeaders) {
      return createInvalidSessionResponse();
    }

    const requestPayload = findAdminExtensionApiKeyRequestSchema.parse(
      await request.json().catch(() => ({})),
    );
    const upstream = await fetchImplementation(`${getInternalApiUrl()}/v1/admin/extension-api-keys/find`, {
      method: "POST",
      headers: {
        ...authorizationHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestPayload),
      cache: "no-store",
    });
    const { ok, status, payload } = await forwardJsonResponse(upstream);

    if (!ok) {
      return createForwardedError({
        payload,
        status,
        fallbackError: "admin_extension_api_key_list_failed",
        fallbackMessage: "The admin extension API key lookup request failed.",
      });
    }

    const parsedResponse = findAdminExtensionApiKeyResponseSchema.safeParse(payload);

    if (!parsedResponse.success) {
      return jsonResponse(
        {
          error: "admin_extension_api_key_list_failed",
          message: "The admin extension API key lookup response was invalid.",
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
