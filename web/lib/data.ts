import { createServiceClient } from "./supabase/service";
import { hasSupabaseEnv } from "./env";
import type { WeeklyFixture } from "./types";

/**
 * Reads with the service role on purpose: the free-tier preview needs
 * value_bets rows that RLS (correctly) hides from non-subscribers. That
 * makes the caller responsible for gating - app/page.tsx strips
 * `valueBets` from any fixture the viewer hasn't unlocked BEFORE it is
 * passed to a component, so locked data never reaches the response.
 * Never import this file from a "use client" component - it would ship
 * nothing useful there anyway (the service key is not NEXT_PUBLIC_).
 */
export async function getWeeklyFixtures(): Promise<WeeklyFixture[]> {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase env vars are not set - rendering an empty fixture list.");
    return [];
  }
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("fixtures")
    .select("*, value_bets(*)")
    .eq("status", "scheduled")
    .order("kickoff_at", { ascending: true });

  if (error) {
    // Logged server-side only - the page shows a plain empty state rather
    // than leaking a Supabase error message to visitors.
    console.error("Failed to load weekly fixtures from Supabase:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    ...row,
    valueBets: (row as unknown as { value_bets: WeeklyFixture["valueBets"] }).value_bets ?? [],
  }));
}
