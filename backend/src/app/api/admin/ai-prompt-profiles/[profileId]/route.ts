import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInternalApiUrl } from "@/lib/api/internal";
import { createAdminAiPromptProfileDetailRouteHandlers } from "./route-handlers.mjs";

export const dynamic = "force-dynamic";

export const { PATCH } = createAdminAiPromptProfileDetailRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
});
