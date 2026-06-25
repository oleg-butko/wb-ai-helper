import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInternalApiUrl } from "@/lib/api/internal";
import { createAdminAiProviderProfileActivateRouteHandlers } from "../route-handlers.mjs";

export const dynamic = "force-dynamic";

export const { POST } = createAdminAiProviderProfileActivateRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
});
