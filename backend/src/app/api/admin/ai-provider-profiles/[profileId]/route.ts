import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInternalApiUrl } from "@/lib/api/internal";
import { createAdminAiProviderProfileDetailRouteHandlers } from "./route-handlers.mjs";

export const dynamic = "force-dynamic";

export const { PATCH } = createAdminAiProviderProfileDetailRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
});
