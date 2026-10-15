import { createClient } from "./supabase/server";
import { hasSupabaseEnv } from "./env";
import type { SettledBet, TrackRecordSummary } from "./trackRecordTypes";

const PAGE_SIZE = 1000; // Supabase's default max rows per request
const MAX_PAGES = 20;

function oddsForSide(bet: SettledBet): number {
  return bet.flagged_side === "H" ? bet.odds_home : bet.flagged_side === "D" ? bet.odds_draw : bet.odds_away;
}

/** Flat 1-unit-stake return: (odds - 1) if the flagged side won, -1 if it lost. */
function pnlForBet(bet: SettledBet): number {
  return bet.won ? oddsForSide(bet) - 1 : -1;
}

const EMPTY_SUMMARY: TrackRecordSummary = {
  totalSettled: 0,
  wins: 0,
  winRate: null,
  totalPnlUnits: 0,
  roiPerBet: null,
};

/**
 * Only bets the model actually flagged as value (is_value = true) count.
 * The pipeline stores a row for every fixture x bookmaker, flagging the
 * best side even when the edge is negative - counting those would make
 * the "track record" a record of every match, not of the picks we
 * recommended. The summary covers ALL settled value bets; only the
 * displayed list is limited to the most recent `limit`.
 */
export async function getTrackRecord(limit = 50): Promise<{
  summary: TrackRecordSummary;
  recentBets: SettledBet[];
}> {
  if (!hasSupabaseEnv()) return { summary: EMPTY_SUMMARY, recentBets: [] };
  const supabase = createClient();
  const bets: SettledBet[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("value_bets")
      .select("*, fixtures(home_team, away_team, kickoff_at)")
      .eq("is_value", true)
      .not("won", "is", null)
      // fixture_id/local_label as tie-breakers keep pagination stable
      .order("settled_at", { ascending: false })
      .order("fixture_id", { ascending: false })
      .order("local_label", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to load track record from Supabase:", error.message);
      return { summary: EMPTY_SUMMARY, recentBets: [] };
    }

    const rows = (data ?? []) as unknown as SettledBet[];
    bets.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }

  const wins = bets.filter((b) => b.won).length;
  const totalPnlUnits = bets.reduce((sum, b) => sum + pnlForBet(b), 0);

  const summary: TrackRecordSummary = {
    totalSettled: bets.length,
    wins,
    winRate: bets.length > 0 ? wins / bets.length : null,
    totalPnlUnits,
    roiPerBet: bets.length > 0 ? totalPnlUnits / bets.length : null,
  };

  return { summary, recentBets: bets.slice(0, limit) };
}
