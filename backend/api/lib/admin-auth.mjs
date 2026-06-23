import { resolveAuthenticatedRequest } from "./auth.mjs";

export async function resolveAppAdminRequest(request, reply) {
  const authentication = await resolveAuthenticatedRequest(request, reply);

  if (!authentication.ok) {
    return authentication;
  }

  if (!(await request.server.services.isAppAdminEmail(authentication.user.email))) {
    return {
      ok: false,
      response: reply.code(403).send({
        error: "app_admin_required",
        message: "The current user is not allowed to use app-admin tools.",
      }),
    };
  }

  return authentication;
}
