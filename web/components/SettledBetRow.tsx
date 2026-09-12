import type { SettledBet } from "@/lib/trackRecordTypes";
import type { MatchSide } from "@/lib/types";

const BOOKMAKER_DISPLAY: Record<string, string> = {
  sportpesa: "SportPesa",
  betika: "Betika",
  other: "Other books",
};

const SIDE_DISPLAY: Record<MatchSide, string> = { H: "Home", D: "Draw", A: "Away" };

function oddsForSide(bet: SettledBet): number {
  return bet.flagged_side === "H" ? bet.odds_home : bet.flagged_side === "D" ? bet.odds_draw : bet.odds_away;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Nairobi",
  }).format(new Date(iso));
}

export function SettledBetRow({ bet }: { bet: SettledBet }) {
  return (
    <div className="flex items-center justify-between border-b border-pitch-700 py-3 text-sm">
      <div>
        <div className="text-chalk">
          {bet.fixtures.home_team} <span className="text-sage">v</span> {bet.fixtures.away_team}
        </div>
        <div className="text-xs text-sage">
          {formatDate(bet.fixtures.kickoff_at)} · {BOOKMAKER_DISPLAY[bet.local_label] ?? bet.local_label} ·{" "}
          {SIDE_DISPLAY[bet.flagged_side]} @ {oddsForSide(bet).toFixed(2)}
        </div>
      </div>
      <span className={`tabular font-medium ${bet.won ? "text-amber" : "text-sage"}`}>
        {bet.won ? "Won" : "Lost"}
      </span>
    </div>
  );
}
