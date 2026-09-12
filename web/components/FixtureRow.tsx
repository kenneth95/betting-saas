import { ProbTrio } from "./ProbTrio";
import type { MatchSide, WeeklyFixture } from "@/lib/types";

const BOOKMAKER_DISPLAY: Record<string, string> = {
  sportpesa: "SportPesa",
  betika: "Betika",
  other: "Other books",
};

const SIDE_DISPLAY: Record<MatchSide, string> = { H: "Home", D: "Draw", A: "Away" };

function oddsForSide(
  vb: { odds_home: number; odds_draw: number; odds_away: number },
  side: MatchSide
): number {
  return side === "H" ? vb.odds_home : side === "D" ? vb.odds_draw : vb.odds_away;
}

function formatKickoff(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  }).format(new Date(iso));
}

export function FixtureRow({ fixture, locked }: { fixture: WeeklyFixture; locked: boolean }) {
  const reference = fixture.valueBets[0];

  return (
    <div className="border-b border-pitch-700 py-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl text-chalk">
          {fixture.home_team} <span className="text-sage">v</span> {fixture.away_team}
        </h2>
        <span className="text-sm text-sage">{formatKickoff(fixture.kickoff_at)}</span>
      </div>

      {locked ? (
        <p className="mt-3 text-sm text-sage">
          Full probabilities and odds comparison for members.{" "}
          <a href="/upgrade" className="text-amber underline underline-offset-2">
            Unlock full weekly picks
          </a>
        </p>
      ) : (
        <>
          <ProbTrio
            home={reference?.model_prob_home}
            draw={reference?.model_prob_draw}
            away={reference?.model_prob_away}
          />

          <div className="mt-3 space-y-1.5">
            {fixture.valueBets.map((vb) => (
              <div
                key={vb.local_label}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-chalk">{BOOKMAKER_DISPLAY[vb.local_label] ?? vb.local_label}</span>
                <span className="tabular text-sage">
                  {SIDE_DISPLAY[vb.flagged_side]} @ {oddsForSide(vb, vb.flagged_side).toFixed(2)}
                </span>
                <span className={`tabular ${vb.is_value ? "text-amber font-semibold" : "text-sage"}`}>
                  {vb.edge >= 0 ? "+" : ""}
                  {(vb.edge * 100).toFixed(1)}%{vb.is_value ? " value" : ""}
                </span>
              </div>
            ))}
            {fixture.valueBets.length === 0 && (
              <p className="text-sm text-sage">No odds captured for this fixture yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
