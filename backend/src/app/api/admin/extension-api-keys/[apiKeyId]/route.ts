import { getInternalApiUrl } from "@/lib/api/internal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminExtensionApiKeyDetailRouteHandlers } from "./route-handlers.mjs";

const handlers = createAdminExtensionApiKeyDetailRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation: fetch,
});

export const GET = handlers.GET;
