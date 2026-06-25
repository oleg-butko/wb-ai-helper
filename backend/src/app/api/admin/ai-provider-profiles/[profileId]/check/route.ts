import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInternalApiUrl } from "@/lib/api/internal";
import { createAdminAiProviderProfileCheckRouteHandlers } from "../route-handlers.mjs";

export const dynamic = "force-dynamic";

export const { POST } = createAdminAiProviderProfileCheckRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
});
