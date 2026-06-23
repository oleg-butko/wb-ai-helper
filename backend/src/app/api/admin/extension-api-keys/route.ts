import { getInternalApiUrl } from "@/lib/api/internal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminExtensionApiKeysRouteHandlers } from "./route-handlers.mjs";

const handlers = createAdminExtensionApiKeysRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
  fetchImplementation: fetch,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
