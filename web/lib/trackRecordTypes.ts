import type { BookmakerLabel, MatchSide } from "./types";

export type SettledBet = {
  fixture_id: number;
  local_label: BookmakerLabel;
  flagged_side: MatchSide;
  edge: number;
  odds_home: number;
  odds_draw: number;
  odds_away: number;
  won: boolean;
  settled_at: string;
  fixtures: {
    home_team: string;
    away_team: string;
    kickoff_at: string;
  };
};

export type TrackRecordSummary = {
  totalSettled: number;
  wins: number;
  winRate: number | null;
  totalPnlUnits: number;
  roiPerBet: number | null;
};
