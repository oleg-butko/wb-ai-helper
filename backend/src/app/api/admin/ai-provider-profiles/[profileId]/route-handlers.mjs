import {
  activateAdminAiProviderProfileResponseSchema,
  adminAiProviderProfileErrorResponseSchema,
  adminAiProviderProfileModelsResponseSchema,
  adminAiProviderProfileCheckResponseSchema,
  updateAdminAiProviderProfileRequestSchema,
  updateAdminAiProviderProfileResponseSchema,
} from "../../../../../shared/api/admin-ai-provider-profiles.mjs";
import {
  createBearerAuthorizationHeaders,
  createInvalidSessionResponse,
  forwardJsonResponse,
  jsonResponse,
} from "../../../../../core/api/next-proxy-helpers.mjs";

function createForwardedError({ payload, status, fallbackError, fallbackMessage }) {
  const parsedError = adminAiProviderProfileErrorResponseSchema.safeParse(payload);

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

export function createAdminAiProviderProfileDetailRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation = globalThis.fetch,
}) {
  async function PATCH(request, { params }) {
    const authorizationHeaders = await createBearerAuthorizationHeaders(createSupabaseServerClient);

    if (!authorizationHeaders) {
      return createInvalidSessionResponse();
    }

    const { profileId } = await params;
    const requestPayload = updateAdminAiProviderProfileRequestSchema.parse(
      await request.json().catch(() => ({})),
    );
    const upstream = await fetchImplementation(
      `${getInternalApiUrl()}/v1/admin/ai-provider-profiles/${encodeURIComponent(profileId)}`,
      {
        method: "PATCH",
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
        fallbackError: "admin_ai_provider_profile_update_failed",
        fallbackMessage: "The admin AI provider profile update request failed.",
      });
    }

    const parsedResponse = updateAdminAiProviderProfileResponseSchema.safeParse(payload);

    if (!parsedResponse.success) {
      return jsonResponse(
        {
          error: "admin_ai_provider_profile_update_failed",
          message: "The admin AI provider profile update response was invalid.",
        },
        { status: 502 },
      );
    }

    return jsonResponse(parsedResponse.data);
  }

  return { PATCH };
}

export function createAdminAiProviderProfileActivateRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation = globalThis.fetch,
}) {
  async function POST(_request, { params }) {
    const authorizationHeaders = await createBearerAuthorizationHeaders(createSupabaseServerClient);

    if (!authorizationHeaders) {
      return createInvalidSessionResponse();
    }

    const { profileId } = await params;
    const upstream = await fetchImplementation(
      `${getInternalApiUrl()}/v1/admin/ai-provider-profiles/${encodeURIComponent(profileId)}/activate`,
      {
        method: "POST",
        headers: {
          ...authorizationHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
        cache: "no-store",
      },
    );
    const { ok, status, payload } = await forwardJsonResponse(upstream);

    if (!ok) {
      return createForwardedError({
        payload,
        status,
        fallbackError: "admin_ai_provider_profile_activate_failed",
        fallbackMessage: "The admin AI provider profile activate request failed.",
      });
    }

    const parsedResponse = activateAdminAiProviderProfileResponseSchema.safeParse(payload);

    if (!parsedResponse.success) {
      return jsonResponse(
        {
          error: "admin_ai_provider_profile_activate_failed",
          message: "The admin AI provider profile activate response was invalid.",
        },
        { status: 502 },
      );
    }

    return jsonResponse(parsedResponse.data);
  }

  return { POST };
}

export function createAdminAiProviderProfileModelsRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation = globalThis.fetch,
}) {
  async function GET(_request, { params }) {
    const authorizationHeaders = await createBearerAuthorizationHeaders(createSupabaseServerClient);

    if (!authorizationHeaders) {
      return createInvalidSessionResponse();
    }

    const { profileId } = await params;
    const upstream = await fetchImplementation(
      `${getInternalApiUrl()}/v1/admin/ai-provider-profiles/${encodeURIComponent(profileId)}/models`,
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
        fallbackError: "admin_ai_provider_profile_models_failed",
        fallbackMessage: "The admin AI provider profile model list request failed.",
      });
    }

    const parsedResponse = adminAiProviderProfileModelsResponseSchema.safeParse(payload);

    if (!parsedResponse.success) {
      return jsonResponse(
        {
          error: "admin_ai_provider_profile_models_failed",
          message: "The admin AI provider profile model list response was invalid.",
        },
        { status: 502 },
      );
    }

    return jsonResponse(parsedResponse.data);
  }

  return { GET };
}

export function createAdminAiProviderProfileCheckRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation = globalThis.fetch,
}) {
  async function POST(request, { params }) {
    const authorizationHeaders = await createBearerAuthorizationHeaders(createSupabaseServerClient);

    if (!authorizationHeaders) {
      return createInvalidSessionResponse();
    }

    const { profileId } = await params;
    const upstream = await fetchImplementation(
      `${getInternalApiUrl()}/v1/admin/ai-provider-profiles/${encodeURIComponent(profileId)}/check`,
      {
        method: "POST",
        headers: {
          ...authorizationHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify(await request.json().catch(() => ({}))),
        cache: "no-store",
      },
    );
    const { ok, status, payload } = await forwardJsonResponse(upstream);

    if (!ok) {
      return createForwardedError({
        payload,
        status,
        fallbackError: "admin_ai_provider_profile_check_failed",
        fallbackMessage: "The admin AI provider profile check request failed.",
      });
    }

    const parsedResponse = adminAiProviderProfileCheckResponseSchema.safeParse(payload);

    if (!parsedResponse.success) {
      return jsonResponse(
        {
          error: "admin_ai_provider_profile_check_failed",
          message: "The admin AI provider profile check response was invalid.",
        },
        { status: 502 },
      );
    }

    return jsonResponse(parsedResponse.data);
  }

  return { POST };
}
