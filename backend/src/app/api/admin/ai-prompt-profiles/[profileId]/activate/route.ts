import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInternalApiUrl } from "@/lib/api/internal";
import { createAdminAiPromptProfileActivateRouteHandlers } from "../route-handlers.mjs";

export const dynamic = "force-dynamic";

export const { POST } = createAdminAiPromptProfileActivateRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
});
