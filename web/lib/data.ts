import { createClient } from "./supabase/server";
import type { WeeklyFixture } from "./types";

export async function getWeeklyFixtures(): Promise<WeeklyFixture[]> {
  const supabase = createClient();

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
