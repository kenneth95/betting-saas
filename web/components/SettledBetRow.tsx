import type { SettledBet } from "@/lib/trackRecordTypes";
import { bookmakerName, formatDate, oddsForSide, sideName } from "@/lib/business";

export function SettledBetRow({ bet }: { bet: SettledBet }) {
  const odds = oddsForSide(bet, bet.flagged_side);
  const units = bet.won ? odds - 1 : -1; // flat 1-unit stake, same maths as the summary
  return (
    <div className="flex items-center justify-between gap-3 border-b border-pitch-700 py-3 text-sm">
      <div>
        <div className="text-chalk">
          {bet.fixtures.home_team} <span className="text-sage">v</span> {bet.fixtures.away_team}
        </div>
        <div className="text-xs text-sage">
          {formatDate(bet.fixtures.kickoff_at)} · {bookmakerName(bet.local_label)} · {sideName(bet.flagged_side)} @{" "}
          {odds.toFixed(2)}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <span className={`font-medium ${bet.won ? "text-amber" : "text-sage"}`}>{bet.won ? "Won" : "Lost"}</span>
        <div className="tabular text-xs text-sage">
          {units >= 0 ? "+" : "−"}
          {Math.abs(units).toFixed(2)}u
        </div>
      </div>
    </div>
  );
}
