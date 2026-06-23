import { getInternalApiUrl } from "@/lib/api/internal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminExtensionApiKeyFindRouteHandlers } from "../route-handlers.mjs";

const handlers = createAdminExtensionApiKeyFindRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation: fetch,
});

export const POST = handlers.POST;
