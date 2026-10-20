import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import pandas as pd

from betting_model.poisson_model import DixonColesModel
from betting_model.config import League
from betting_model.pipeline import compute_value_bets, fetch_upcoming_fixtures_with_odds, push_to_supabase, weekly_refresh
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


def test_compute_value_bets_never_flags_value_for_teams_the_model_has_not_seen():
    model = _toy_model()
    fixtures = [{
        "fixture_id": 9, "kickoff_at": "2026-09-13T15:00:00+00:00",
        "home_team": "Arsenal", "away_team": "Totally New FC",
        "odds_by_bookmaker": {"Bet365": (10.0, 6.0, 1.2)},  # absurd price -> huge "edge" for any model
    }]
    rows = compute_value_bets(fixtures, model, edge_threshold=0.0)
    assert len(rows) == 1
    assert rows[0]["away_team_known"] is False
    assert rows[0]["is_value"] is False


def _api_fixture(fixture_id, status, home="Arsenal", away="Chelsea"):
    return {
        "fixture": {"id": fixture_id, "date": "2026-09-13T15:00:00+00:00", "status": {"short": status}},
        "teams": {"home": {"name": home}, "away": {"name": away}},
    }


class FakeOddsAPI:
    def __init__(self, fixtures, failing_ids=()):
        self._fixtures, self._failing = fixtures, set(failing_ids)
        self.odds_calls = []

    def get_fixtures(self, *args):
        return self._fixtures

    def get_odds(self, fixture_id):
        self.odds_calls.append(fixture_id)
        if fixture_id in self._failing:
            raise RuntimeError("rate limited")
        return [{"bookmakers": [{"name": "Bet365", "bets": [{"name": "Match Winner", "values": [
            {"value": "Home", "odd": "2.1"}, {"value": "Draw", "odd": "3.4"}, {"value": "Away", "odd": "3.2"}]}]}]}]


def _league():
    return League(code="epl", name="EPL", data_folder="data/raw/epl", api_sports_league_id=39)


def test_fetch_skips_fixtures_that_have_already_started_or_finished():
    api = FakeOddsAPI([_api_fixture(1, "NS"), _api_fixture(2, "FT"), _api_fixture(3, "1H"), _api_fixture(4, "PST")])
    result = fetch_upcoming_fixtures_with_odds(api, _league(), season=2026)
    assert [fx["fixture_id"] for fx in result] == [1]
    assert api.odds_calls == [1]  # no wasted API calls for fixtures we won't write


def test_fetch_isolates_a_failing_odds_request():
    api = FakeOddsAPI([_api_fixture(1, "NS"), _api_fixture(2, "NS")], failing_ids={1})
    result = {fx["fixture_id"]: fx for fx in fetch_upcoming_fixtures_with_odds(api, _league(), season=2026)}
    assert result[1]["odds_error"] and result[1]["odds_by_bookmaker"] == {}
    assert result[2]["odds_error"] is None and "Bet365" in result[2]["odds_by_bookmaker"]


def test_weekly_refresh_summary_reports_errors_and_unknown_teams():
    model = _toy_model()
    api = FakeOddsAPI([_api_fixture(1, "NS"), _api_fixture(2, "NS", home="Arsenal", away="Newcomers FC")], failing_ids={1})
    summary = weekly_refresh(_league(), api, FakeSupabase(), model, season=2026)
    assert summary["n_odds_errors"] == 1
    assert summary["n_fixtures_without_odds"] == 1
    assert summary["unknown_teams"] == ["Newcomers FC"]


def test_push_stamps_computed_at_so_stale_odds_are_detectable():
    fake = FakeSupabase()
    fixtures = [{"fixture_id": 1, "kickoff_at": "2026-09-13T15:00:00+00:00", "home_team": "A", "away_team": "B"}]
    value_bets = [{
        "fixture_id": 1, "local_label": "sportpesa",
        "model_prob_home": 0.5, "model_prob_draw": 0.3, "model_prob_away": 0.2,
        "implied_prob_home": 0.4, "implied_prob_draw": 0.3, "implied_prob_away": 0.3,
        "odds_home": 2.5, "odds_draw": 3.3, "odds_away": 3.3,
        "flagged_side": "H", "edge": 0.1, "is_value": True,
    }]
    push_to_supabase(fake, fixtures, value_bets)
    by_table = {c["table"]: c["rows"][0] for c in fake.calls}
    assert by_table["value_bets"]["computed_at"]
    assert "won" not in by_table["value_bets"]  # re-running a refresh must never wipe a settled result
