import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInternalApiUrl } from "@/lib/api/internal";
import { createAdminAiProviderProfileModelsRouteHandlers } from "../route-handlers.mjs";

export const dynamic = "force-dynamic";

export const { GET } = createAdminAiProviderProfileModelsRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
});
