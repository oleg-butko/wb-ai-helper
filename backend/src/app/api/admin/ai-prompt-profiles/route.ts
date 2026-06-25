import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInternalApiUrl } from "@/lib/api/internal";
import { createAdminAiPromptProfilesRouteHandlers } from "./route-handlers.mjs";

export const dynamic = "force-dynamic";

export const { GET, POST } = createAdminAiPromptProfilesRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
});
