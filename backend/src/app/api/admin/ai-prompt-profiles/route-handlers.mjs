import {
  adminAiPromptProfileErrorResponseSchema,
  adminAiPromptProfileListResponseSchema,
  adminAiPromptProfileResponseSchema,
  createAdminAiPromptProfileRequestSchema,
} from "../../../../shared/api/admin-ai-prompt-profiles.mjs";
import {
  createBearerAuthorizationHeaders,
  createInvalidSessionResponse,
  forwardJsonResponse,
  jsonResponse,
} from "../../../../core/api/next-proxy-helpers.mjs";

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

export function createAdminAiPromptProfilesRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation = globalThis.fetch,
}) {
  async function GET() {
    const authorizationHeaders = await createBearerAuthorizationHeaders(createSupabaseServerClient);

    if (!authorizationHeaders) {
      return createInvalidSessionResponse();
    }

    const upstream = await fetchImplementation(`${getInternalApiUrl()}/v1/admin/ai-prompt-profiles`, {
      method: "GET",
      headers: authorizationHeaders,
      cache: "no-store",
    });
    const { ok, status, payload } = await forwardJsonResponse(upstream);

    if (!ok) {
      return createForwardedError({
        payload,
        status,
        fallbackError: "admin_ai_prompt_profile_list_failed",
        fallbackMessage: "The admin AI prompt profile list request failed.",
      });
    }

    const parsedResponse = adminAiPromptProfileListResponseSchema.safeParse(payload);

    if (!parsedResponse.success) {
      return jsonResponse({
        error: "admin_ai_prompt_profile_list_failed",
        message: "The admin AI prompt profile list response was invalid.",
      }, { status: 502 });
    }

    return jsonResponse(parsedResponse.data);
  }

  async function POST(request) {
    const authorizationHeaders = await createBearerAuthorizationHeaders(createSupabaseServerClient);

    if (!authorizationHeaders) {
      return createInvalidSessionResponse();
    }

    const requestPayload = createAdminAiPromptProfileRequestSchema.parse(
      await request.json().catch(() => ({})),
    );
    const upstream = await fetchImplementation(`${getInternalApiUrl()}/v1/admin/ai-prompt-profiles`, {
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
        fallbackError: "admin_ai_prompt_profile_create_failed",
        fallbackMessage: "The admin AI prompt profile create request failed.",
      });
    }

    const parsedResponse = adminAiPromptProfileResponseSchema.safeParse(payload);

    if (!parsedResponse.success) {
      return jsonResponse({
        error: "admin_ai_prompt_profile_create_failed",
        message: "The admin AI prompt profile create response was invalid.",
      }, { status: 502 });
    }

    return jsonResponse(parsedResponse.data, { status: 201 });
  }

  return { GET, POST };
}
