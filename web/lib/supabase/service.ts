import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Uses the service role key, which bypasses row-level security entirely.
 * Only ever import this into Route Handlers (app/api/**) - never into a
 * Server Component that might get bundled somewhere a client could reach,
 * and never into anything under "use client".
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
