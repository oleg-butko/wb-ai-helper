import { getInternalApiUrl } from "@/lib/api/internal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminExtensionApiKeyQuotaRouteHandlers } from "../route-handlers.mjs";

const handlers = createAdminExtensionApiKeyQuotaRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation: fetch,
});

export const POST = handlers.POST;
