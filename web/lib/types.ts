export type BookmakerLabel = "sportpesa" | "betika" | "other";
export type MatchSide = "H" | "D" | "A";

export type ValueBetRow = {
  fixture_id: number;
  local_label: BookmakerLabel;
  model_prob_home: number;
  model_prob_draw: number;
  model_prob_away: number;
  implied_prob_home: number;
  implied_prob_draw: number;
  implied_prob_away: number;
  odds_home: number;
  odds_draw: number;
  odds_away: number;
  flagged_side: MatchSide;
  edge: number;
  is_value: boolean;
  computed_at: string;
};

export type FixtureRow = {
  id: number;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  status: "scheduled" | "finished" | "void";
  result: MatchSide | null;
};

export type WeeklyFixture = FixtureRow & {
  valueBets: ValueBetRow[];
};
