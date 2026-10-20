"""
Scores fixtures that have kicked off but are still marked 'scheduled':
pulls the final score from api-sports.io, settles each of the fixture's
value_bets rows won/lost by comparing the flagged side to what actually
happened, then marks the fixture finished.

This is what turns raw predictions into a public track record - the
single strongest trust signal a value-betting product has, precisely
because it shows the losses too, not just the wins.

Run this daily via scripts/score_results.py.

Design notes
- Bets are settled BEFORE the fixture is marked finished. The "pending"
  query only looks at status='scheduled', so if the order were reversed and
  the bet update failed, that fixture would never be retried and its bets
  would stay unsettled forever. This order makes every failure self-healing
  on the next run.
- Bets are changed with PATCH (update), never upsert: a partial upsert is
  rejected by Postgres because value_bets has NOT NULL columns.
- Cancelled/abandoned/awarded matches are marked 'void' and their bets are
  left unsettled (won = null), so they never count for or against the model.
- The API lookback window stretches back to the oldest pending kickoff, so a
  few missed days of the scheduled job can't leave matches unscored.
"""
from __future__ import annotations

import datetime as dt

from .api_sports_client import APISportsClient
from .config import League

# api-sports.io fixture status codes after which no result will ever count.
VOID_STATUSES = {"CANC", "ABD", "AWD", "WO"}
MAX_LOOKBACK_DAYS = 45


def _parse_ts(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def _outcome(item: dict) -> str | None:
    """'H' | 'D' | 'A' for a full-time match, else None."""
    if item["fixture"]["status"]["short"] != "FT":
        return None
    home_goals, away_goals = item["goals"]["home"], item["goals"]["away"]
    if home_goals is None or away_goals is None:
        return None
    return "H" if home_goals > away_goals else ("A" if away_goals > home_goals else "D")


def score_recent_fixtures(
    api_client: APISportsClient,
    supabase_client,
    league: League,
    season: int,
    lookback_days: int = 10,
) -> dict:
    now = dt.datetime.now(dt.timezone.utc)

    pending = supabase_client.select(
        "fixtures",
        params={
            "status": "eq.scheduled",
            "kickoff_at": f"lt.{now.isoformat()}",
            "select": "id,home_team,away_team,kickoff_at",
        },
    )
    summary = {"n_pending": len(pending), "n_scored": 0, "n_voided": 0, "n_errors": 0}
    if not pending:
        return summary

    oldest_pending = min(_parse_ts(f["kickoff_at"]) for f in pending).date()
    today = now.date()
    date_from = min(today - dt.timedelta(days=lookback_days), oldest_pending)
    date_from = max(date_from, today - dt.timedelta(days=MAX_LOOKBACK_DAYS))
    fixtures = api_client.get_fixtures(
        league.api_sports_league_id, season, date_from.isoformat(), today.isoformat()
    )

    results: dict[int, str] = {}
    voided: set[int] = set()
    for item in fixtures:
        fixture_id = item["fixture"]["id"]
        if item["fixture"]["status"]["short"] in VOID_STATUSES:
            voided.add(fixture_id)
            continue
        outcome = _outcome(item)
        if outcome is not None:
            results[fixture_id] = outcome

    for fixture in pending:
        fixture_id = fixture["id"]
        stamp = dt.datetime.now(dt.timezone.utc).isoformat()
        try:
            if fixture_id in voided:
                supabase_client.update(
                    "fixtures", {"id": f"eq.{fixture_id}"}, {"status": "void", "updated_at": stamp}
                )
                summary["n_voided"] += 1
                continue

            result = results.get(fixture_id)
            if result is None:
                continue  # not finished yet as far as api-sports.io knows - leave for the next run

            bets = supabase_client.select(
                "value_bets",
                params={"fixture_id": f"eq.{fixture_id}", "select": "fixture_id,local_label,flagged_side"},
            )
            for bet in bets:
                supabase_client.update(
                    "value_bets",
                    {"fixture_id": f"eq.{fixture_id}", "local_label": f"eq.{bet['local_label']}"},
                    {"won": bet["flagged_side"] == result, "settled_at": stamp},
                )
            supabase_client.update(
                "fixtures",
                {"id": f"eq.{fixture_id}"},
                {"status": "finished", "result": result, "updated_at": stamp},
            )
            summary["n_scored"] += 1
        except Exception as exc:  # one bad fixture must not block the rest
            summary["n_errors"] += 1
            print(f"Could not score fixture {fixture_id}: {exc}")

    return summary
