import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Uses the service role key, which bypasses row-level security entirely.
 * Server-side only: Route Handlers (app/api/**) and server-only data
 * modules (lib/data.ts). Never import it into anything under "use client".
 * Any caller that returns data to a browser is responsible for its own
 * access checks, since RLS does not apply here.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
