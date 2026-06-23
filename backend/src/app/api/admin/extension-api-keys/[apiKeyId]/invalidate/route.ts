import { getInternalApiUrl } from "@/lib/api/internal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminExtensionApiKeyInvalidateRouteHandlers } from "../route-handlers.mjs";

const handlers = createAdminExtensionApiKeyInvalidateRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation: fetch,
});

export const POST = handlers.POST;
