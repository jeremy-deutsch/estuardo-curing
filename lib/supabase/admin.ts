import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

export function adminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret)
    throw new Error("Set SUPABASE_SECRET_KEY to enable staff approvals.");
  return createClient(supabaseConfig().url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
