"""
Scores fixtures that have kicked off but are still marked 'scheduled':
pulls the final score from api-sports.io, updates the fixture's status
and result, and marks each of its value_bets rows won/lost by comparing
the flagged side to what actually happened.

This is what turns raw predictions into a public track record - the
single strongest trust signal a value-betting product has, precisely
because it shows the losses too, not just the wins.

Run this daily (results.py doesn't wait for a weekly cadence - matches
finish throughout the week) via scripts/score_results.py.
"""
from __future__ import annotations

import datetime as dt

from .api_sports_client import APISportsClient
from .config import League


def score_recent_fixtures(
    api_client: APISportsClient,
    supabase_client,
    league: League,
    season: int,
    lookback_days: int = 10,
) -> dict:
    now_iso = dt.datetime.now(dt.timezone.utc).isoformat()

    pending = supabase_client.select(
        "fixtures",
        params={
            "status": "eq.scheduled",
            "kickoff_at": f"lt.{now_iso}",
            "select": "id,home_team,away_team,kickoff_at",
        },
    )
    if not pending:
        return {"n_pending": 0, "n_scored": 0}

    today = dt.date.today()
    date_from = (today - dt.timedelta(days=lookback_days)).isoformat()
    date_to = today.isoformat()
    fixtures = api_client.get_fixtures(league.api_sports_league_id, season, date_from, date_to)

    final_results: dict[int, str] = {}
    for item in fixtures:
        if item["fixture"]["status"]["short"] != "FT":
            continue
        home_goals = item["goals"]["home"]
        away_goals = item["goals"]["away"]
        if home_goals is None or away_goals is None:
            continue
        final_results[item["fixture"]["id"]] = (
            "H" if home_goals > away_goals else ("A" if away_goals > home_goals else "D")
        )

    n_scored = 0
    for fixture in pending:
        result = final_results.get(fixture["id"])
        if result is None:
            continue  # not finished yet as far as api-sports.io knows - leave for the next run

        supabase_client.upsert(
            "fixtures",
            [{
                "id": fixture["id"],
                "home_team": fixture["home_team"],
                "away_team": fixture["away_team"],
                "kickoff_at": fixture["kickoff_at"],
                "status": "finished",
                "result": result,
            }],
            on_conflict="id",
        )

        value_bets = supabase_client.select(
            "value_bets",
            params={"fixture_id": f"eq.{fixture['id']}", "select": "fixture_id,local_label,flagged_side"},
        )
        settled_at = dt.datetime.now(dt.timezone.utc).isoformat()
        for vb in value_bets:
            supabase_client.upsert(
                "value_bets",
                [{
                    "fixture_id": vb["fixture_id"],
                    "local_label": vb["local_label"],
                    "won": vb["flagged_side"] == result,
                    "settled_at": settled_at,
                }],
                on_conflict="fixture_id,local_label",
            )
        n_scored += 1

    return {"n_pending": len(pending), "n_scored": n_scored}
