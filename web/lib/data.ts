import { createServiceClient } from "./supabase/service";
import { hasSupabaseEnv } from "./env";
import type { FixtureRow, ValueBetRow, WeeklyFixture } from "./types";

// Matches stay 'scheduled' until the daily results job scores them, so a
// game in progress (or finished a few hours ago) is still on the board. Past
// this window a still-'scheduled' fixture is stale (postponed, or the job
// hasn't caught up) and shouldn't be shown as "this week".
const STALE_AFTER_MS = 4 * 60 * 60 * 1000;

/**
 * Reads with the service role on purpose: the free-tier preview needs
 * value_bets rows that RLS (correctly) hides from non-subscribers. That
 * makes the caller responsible for gating - app/picks/page.tsx strips
 * `valueBets` from any fixture the viewer hasn't unlocked BEFORE it is
 * passed to a component, so locked data never reaches the response.
 * Never import this file from a "use client" component.
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
    .gte("kickoff_at", new Date(Date.now() - STALE_AFTER_MS).toISOString())
    .order("kickoff_at", { ascending: true });

  if (error) {
    // Logged server-side only - the page shows a plain empty state rather
    // than leaking a Supabase error message to visitors.
    console.error("Failed to load weekly fixtures from Supabase:", error.message);
    return [];
  }

  const rows = (data ?? []) as Array<FixtureRow & { value_bets: ValueBetRow[] | null }>;
  return rows.map(({ value_bets, ...fixture }) => ({ ...fixture, valueBets: value_bets ?? [] }));
}
