import {
  adminAiPromptProfileErrorResponseSchema,
  adminAiPromptProfilePreviewResponseSchema,
  adminAiPromptProfileResponseSchema,
  deleteAdminAiPromptProfileResponseSchema,
  previewAdminAiPromptProfileRequestSchema,
  updateAdminAiPromptProfileRequestSchema,
} from "../../../../../shared/api/admin-ai-prompt-profiles.mjs";
import {
  createBearerAuthorizationHeaders,
  createInvalidSessionResponse,
  forwardJsonResponse,
  jsonResponse,
} from "../../../../../core/api/next-proxy-helpers.mjs";

function createForwardedError({ payload, status, fallbackError, fallbackMessage }) {
  const parsedError = adminAiPromptProfileErrorResponseSchema.safeParse(payload);

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

async function forwardPromptProfileAction({
  createSupabaseServerClient,
  fetchImplementation,
  getInternalApiUrl,
  profileId,
  pathSuffix = "",
  requestPayload,
  fallbackError,
  fallbackMessage,
  responseSchema,
  method = pathSuffix ? "POST" : "PATCH",
}) {
  const authorizationHeaders = await createBearerAuthorizationHeaders(createSupabaseServerClient);

  if (!authorizationHeaders) {
    return createInvalidSessionResponse();
  }

  const headers = method === "DELETE"
    ? authorizationHeaders
    : {
        ...authorizationHeaders,
        "content-type": "application/json",
      };

  const upstream = await fetchImplementation(
    `${getInternalApiUrl()}/v1/admin/ai-prompt-profiles/${encodeURIComponent(profileId)}${pathSuffix}`,
    {
      method,
      headers,
      body: method === "DELETE" ? undefined : JSON.stringify(requestPayload ?? {}),
      cache: "no-store",
    },
  );
  const { ok, status, payload } = await forwardJsonResponse(upstream);

  if (!ok) {
    return createForwardedError({
      payload,
      status,
      fallbackError,
      fallbackMessage,
    });
  }

  const parsedResponse = responseSchema.safeParse(payload);

  if (!parsedResponse.success) {
    return jsonResponse({
      error: fallbackError,
      message: fallbackMessage,
    }, { status: 502 });
  }

  return jsonResponse(parsedResponse.data);
}

export function createAdminAiPromptProfileDetailRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation = globalThis.fetch,
}) {
  async function PATCH(request, { params }) {
    const { profileId } = await params;
    const requestPayload = updateAdminAiPromptProfileRequestSchema.parse(
      await request.json().catch(() => ({})),
    );

    return forwardPromptProfileAction({
      createSupabaseServerClient,
      fetchImplementation,
      getInternalApiUrl,
      profileId,
      requestPayload,
      fallbackError: "admin_ai_prompt_profile_update_failed",
      fallbackMessage: "The admin AI prompt profile update request failed.",
      responseSchema: adminAiPromptProfileResponseSchema,
    });
  }

  async function DELETE(_request, { params }) {
    const { profileId } = await params;

    return forwardPromptProfileAction({
      createSupabaseServerClient,
      fetchImplementation,
      getInternalApiUrl,
      profileId,
      fallbackError: "admin_ai_prompt_profile_delete_failed",
      fallbackMessage: "The admin AI prompt profile delete request failed.",
      responseSchema: deleteAdminAiPromptProfileResponseSchema,
      method: "DELETE",
    });
  }

  return { PATCH, DELETE };
}

export function createAdminAiPromptProfilePreviewRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation = globalThis.fetch,
}) {
  async function POST(request, { params }) {
    const { profileId } = await params;
    const requestPayload = previewAdminAiPromptProfileRequestSchema.parse(
      await request.json().catch(() => ({})),
    );

    return forwardPromptProfileAction({
      createSupabaseServerClient,
      fetchImplementation,
      getInternalApiUrl,
      profileId,
      pathSuffix: "/preview",
      requestPayload,
      fallbackError: "admin_ai_prompt_profile_preview_failed",
      fallbackMessage: "The admin AI prompt profile preview request failed.",
      responseSchema: adminAiPromptProfilePreviewResponseSchema,
    });
  }

  return { POST };
}

export function createAdminAiPromptProfileActivateRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation = globalThis.fetch,
}) {
  async function POST(_request, { params }) {
    const { profileId } = await params;

    return forwardPromptProfileAction({
      createSupabaseServerClient,
      fetchImplementation,
      getInternalApiUrl,
      profileId,
      pathSuffix: "/activate",
      fallbackError: "admin_ai_prompt_profile_activate_failed",
      fallbackMessage: "The admin AI prompt profile activate request failed.",
      responseSchema: adminAiPromptProfileResponseSchema,
    });
  }

  return { POST };
}
