import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import pandas as pd

from betting_model.poisson_model import DixonColesModel
from betting_model.pipeline import compute_value_bets, push_to_supabase
from betting_model.api_sports_client import extract_1x2_odds


def _toy_model():
    rows = []
    date = pd.Timestamp("2023-08-01")
    teams = ["Arsenal", "Chelsea", "Liverpool", "Man City"]
    for h in teams:
        for a in teams:
            if h != a:
                rows.append({"Date": date, "HomeTeam": h, "AwayTeam": a, "FTHG": 1, "FTAG": 0})
                date += pd.Timedelta(days=3)
    return DixonColesModel().fit(pd.DataFrame(rows))


def test_extract_1x2_odds_reads_match_winner_market():
    # Shape mirrors api-sports.io's real /odds response structure.
    odds_item = {
        "bookmakers": [
            {"name": "Bet365", "bets": [
                {"name": "Match Winner", "values": [
                    {"value": "Home", "odd": "2.10"},
                    {"value": "Draw", "odd": "3.40"},
                    {"value": "Away", "odd": "3.20"},
                ]},
            ]},
            {"name": "SomeOtherBookmaker", "bets": []},
        ]
    }
    result = extract_1x2_odds(odds_item, ["Bet365", "Betfair", "1xBet"])
    assert result == {"Bet365": (2.10, 3.40, 3.20)}
    assert "SomeOtherBookmaker" not in result


def test_compute_value_bets_one_row_per_bookmaker_present():
    model = _toy_model()
    fixtures = [{
        "fixture_id": 1,
        "kickoff_at": "2026-09-13T15:00:00+00:00",
        "home_team": "Arsenal",
        "away_team": "Chelsea",
        "odds_by_bookmaker": {
            "Bet365": (5.0, 4.0, 1.5),
            "Betfair": (2.0, 3.4, 3.6),
            # 1xBet deliberately missing - should just be skipped, not crash
        },
    }]
    value_bets = compute_value_bets(fixtures, model, edge_threshold=0.01)

    assert len(value_bets) == 2
    assert {vb["local_label"] for vb in value_bets} == {"sportpesa", "betika"}
    for vb in value_bets:
        total_model = vb["model_prob_home"] + vb["model_prob_draw"] + vb["model_prob_away"]
        total_implied = vb["implied_prob_home"] + vb["implied_prob_draw"] + vb["implied_prob_away"]
        assert abs(total_model - 1.0) < 1e-6
        assert abs(total_implied - 1.0) < 1e-6


def test_compute_value_bets_flags_only_above_threshold():
    model = _toy_model()
    fixtures = [{
        "fixture_id": 1, "kickoff_at": "2026-09-13T15:00:00+00:00",
        "home_team": "Arsenal", "away_team": "Chelsea",
        "odds_by_bookmaker": {"Bet365": (2.0, 3.4, 3.6)},  # roughly matches model, no real edge
    }]
    value_bets = compute_value_bets(fixtures, model, edge_threshold=0.5)  # deliberately high bar
    assert all(vb["is_value"] is False for vb in value_bets)


class FakeSupabase:
    def __init__(self):
        self.calls = []

    def upsert(self, table, rows, on_conflict):
        self.calls.append({"table": table, "rows": rows, "on_conflict": on_conflict})


def test_push_to_supabase_writes_both_tables_with_correct_conflict_keys():
    fake = FakeSupabase()
    fixtures = [{
        "fixture_id": 1, "kickoff_at": "2026-09-13T15:00:00+00:00",
        "home_team": "Arsenal", "away_team": "Chelsea",
    }]
    value_bets = [{
        "fixture_id": 1, "local_label": "sportpesa",
        "model_prob_home": 0.5, "model_prob_draw": 0.3, "model_prob_away": 0.2,
        "implied_prob_home": 0.4, "implied_prob_draw": 0.3, "implied_prob_away": 0.3,
        "odds_home": 2.5, "odds_draw": 3.3, "odds_away": 3.3,
        "flagged_side": "H", "edge": 0.1, "is_value": True,
    }]

    push_to_supabase(fake, fixtures, value_bets)

    calls_by_table = {c["table"]: c for c in fake.calls}
    assert set(calls_by_table) == {"fixtures", "value_bets"}
    assert calls_by_table["fixtures"]["on_conflict"] == "id"
    assert calls_by_table["value_bets"]["on_conflict"] == "fixture_id,local_label"
    assert calls_by_table["fixtures"]["rows"][0]["id"] == 1
