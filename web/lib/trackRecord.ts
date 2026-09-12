import { createClient } from "./supabase/server";
import type { SettledBet, TrackRecordSummary } from "./trackRecordTypes";

function oddsForSide(bet: SettledBet): number {
  return bet.flagged_side === "H" ? bet.odds_home : bet.flagged_side === "D" ? bet.odds_draw : bet.odds_away;
}

/** Flat 1-unit-stake return: (odds - 1) if the flagged side won, -1 if it lost. */
function pnlForBet(bet: SettledBet): number {
  return bet.won ? oddsForSide(bet) - 1 : -1;
}

export async function getTrackRecord(limit = 50): Promise<{
  summary: TrackRecordSummary;
  recentBets: SettledBet[];
}> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("value_bets")
    .select("*, fixtures(home_team, away_team, kickoff_at)")
    .not("won", "is", null)
    .order("settled_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to load track record from Supabase:", error.message);
    return {
      summary: { totalSettled: 0, wins: 0, winRate: null, totalPnlUnits: 0, roiPerBet: null },
      recentBets: [],
    };
  }

  const bets = (data ?? []) as unknown as SettledBet[];
  const wins = bets.filter((b) => b.won).length;
  const totalPnlUnits = bets.reduce((sum, b) => sum + pnlForBet(b), 0);

  const summary: TrackRecordSummary = {
    totalSettled: bets.length,
    wins,
    winRate: bets.length > 0 ? wins / bets.length : null,
    totalPnlUnits,
    roiPerBet: bets.length > 0 ? totalPnlUnits / bets.length : null,
  };

  return { summary, recentBets: bets };
}
