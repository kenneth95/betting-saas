import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import datetime as dt

from betting_model.config import League
from betting_model.results import score_recent_fixtures


class FakeAPIClient:
    def __init__(self, fixtures_response):
        self._fixtures_response = fixtures_response
        self.last_response_headers = {"x-ratelimit-requests-remaining": "99"}

    def get_fixtures(self, league_id, season, date_from, date_to):
        return self._fixtures_response

    def remaining_requests_today(self):
        return self.last_response_headers["x-ratelimit-requests-remaining"]


class FakeSupabase:
    def __init__(self, fixtures_table, value_bets_table):
        self.fixtures_table = {f["id"]: dict(f) for f in fixtures_table}
        self.value_bets_table = {(v["fixture_id"], v["local_label"]): dict(v) for v in value_bets_table}

    def select(self, table, params=None):
        params = params or {}
        if table == "fixtures":
            rows = list(self.fixtures_table.values())
            if params.get("status") == "eq.scheduled":
                rows = [r for r in rows if r["status"] == "scheduled"]
            return rows
        if table == "value_bets":
            fixture_filter = params.get("fixture_id", "")
            fixture_id = int(fixture_filter.replace("eq.", "")) if fixture_filter else None
            rows = list(self.value_bets_table.values())
            if fixture_id is not None:
                rows = [r for r in rows if r["fixture_id"] == fixture_id]
            return rows
        raise ValueError(f"Unexpected table {table}")

    def upsert(self, table, rows, on_conflict):
        for row in rows:
            if table == "fixtures":
                self.fixtures_table.setdefault(row["id"], {}).update(row)
            elif table == "value_bets":
                key = (row["fixture_id"], row["local_label"])
                self.value_bets_table.setdefault(key, {}).update(row)


def _league():
    return League(code="epl", name="EPL", data_folder="data/raw/epl", api_sports_league_id=39)


def test_score_recent_fixtures_marks_won_and_lost_correctly():
    past_kickoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=2)).isoformat()

    fixtures_table = [{
        "id": 1, "home_team": "Arsenal", "away_team": "Chelsea",
        "kickoff_at": past_kickoff, "status": "scheduled", "result": None,
    }]
    value_bets_table = [
        {"fixture_id": 1, "local_label": "sportpesa", "flagged_side": "H"},  # should win - Arsenal won
        {"fixture_id": 1, "local_label": "betika", "flagged_side": "A"},     # should lose
    ]

    api_client = FakeAPIClient(fixtures_response=[{
        "fixture": {"id": 1, "status": {"short": "FT"}},
        "goals": {"home": 2, "away": 0},
    }])
    supabase = FakeSupabase(fixtures_table, value_bets_table)

    summary = score_recent_fixtures(api_client, supabase, _league(), season=2025)

    assert summary == {"n_pending": 1, "n_scored": 1}
    assert supabase.fixtures_table[1]["status"] == "finished"
    assert supabase.fixtures_table[1]["result"] == "H"
    assert supabase.value_bets_table[(1, "sportpesa")]["won"] is True
    assert supabase.value_bets_table[(1, "betika")]["won"] is False
    assert supabase.value_bets_table[(1, "sportpesa")]["settled_at"] is not None


def test_score_recent_fixtures_leaves_unfinished_matches_alone():
    past_kickoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1)).isoformat()
    fixtures_table = [{
        "id": 2, "home_team": "Liverpool", "away_team": "Man City",
        "kickoff_at": past_kickoff, "status": "scheduled", "result": None,
    }]

    api_client = FakeAPIClient(fixtures_response=[{
        "fixture": {"id": 2, "status": {"short": "1H"}},  # still in progress
        "goals": {"home": 1, "away": 0},
    }])
    supabase = FakeSupabase(fixtures_table, value_bets_table=[])

    summary = score_recent_fixtures(api_client, supabase, _league(), season=2025)

    assert summary == {"n_pending": 1, "n_scored": 0}
    assert supabase.fixtures_table[2]["status"] == "scheduled"  # untouched


def test_score_recent_fixtures_handles_no_pending_fixtures():
    api_client = FakeAPIClient(fixtures_response=[])
    supabase = FakeSupabase(fixtures_table=[], value_bets_table=[])

    summary = score_recent_fixtures(api_client, supabase, _league(), season=2025)

    assert summary == {"n_pending": 0, "n_scored": 0}
