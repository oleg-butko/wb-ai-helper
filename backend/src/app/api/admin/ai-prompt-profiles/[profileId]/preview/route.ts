import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInternalApiUrl } from "@/lib/api/internal";
import { createAdminAiPromptProfilePreviewRouteHandlers } from "../route-handlers.mjs";

export const dynamic = "force-dynamic";

export const { POST } = createAdminAiPromptProfilePreviewRouteHandlers({
  createSupabaseServerClient,
  getInternalApiUrl,
});
