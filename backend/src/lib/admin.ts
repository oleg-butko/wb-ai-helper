import { cache } from "react";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const isAdminEmail = cache(async (email: string | null): Promise<boolean> => {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalizedEmail) {
    return false;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admins")
    .select("email, disabled_at")
    .eq("email", normalizedEmail)
    .is("disabled_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
});
