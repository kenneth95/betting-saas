"""
Weekly production pipeline.

Every function here takes its dependencies (api_client, supabase_client,
model) as arguments rather than constructing them internally - that's
what makes this testable without hitting either real service. See
scripts/weekly_refresh.py for how real credentials get wired in.
"""
from __future__ import annotations

import datetime as dt

from .api_sports_client import APISportsClient, extract_1x2_odds
from .config import League
from .odds import devig_1x2
from .poisson_model import DixonColesModel
from .team_map import load_team_map, map_team_name

# api-sports.io bookmaker name -> the label your frontend shows to users.
# This mapping is the "SportPesa uses Bet365 odds" etc. relationship you
# verified empirically - revisit it if that assumption ever stops holding.
TARGET_BOOKMAKERS = {
    "Bet365": "sportpesa",
    "Betfair": "betika",
    "1xBet": "other",
}


# api-sports.io status codes for a match that has not kicked off. Anything
# else (live, finished, postponed...) must NOT be written by this job: live
# odds would overwrite the pre-match prices the track record is judged
# against, and re-writing a finished fixture would flip it back to 'scheduled'.
NOT_STARTED = {"NS", "TBD"}


def fetch_upcoming_fixtures_with_odds(
    api_client: APISportsClient, league: League, season: int, days_ahead: int = 8,
) -> list[dict]:
    today = dt.date.today()
    date_from = today.isoformat()
    date_to = (today + dt.timedelta(days=days_ahead)).isoformat()

    fixtures = api_client.get_fixtures(league.api_sports_league_id, season, date_from, date_to)
    team_map = load_team_map(league.code)

    enriched = []
    for item in fixtures:
        if item["fixture"]["status"]["short"] not in NOT_STARTED:
            continue
        fixture_id = item["fixture"]["id"]

        odds_by_bookmaker: dict[str, tuple[float, float, float]] = {}
        odds_error = None
        try:
            for odds_item in api_client.get_odds(fixture_id):
                odds_by_bookmaker.update(extract_1x2_odds(odds_item, list(TARGET_BOOKMAKERS.keys())))
        except Exception as exc:  # one fixture's odds failing shouldn't sink the whole week
            odds_error = str(exc)
            print(f"Could not fetch odds for fixture {fixture_id}: {exc}")

        enriched.append({
            "fixture_id": fixture_id,
            "kickoff_at": item["fixture"]["date"],
            "home_team": map_team_name(league.code, item["teams"]["home"]["name"], team_map),
            "away_team": map_team_name(league.code, item["teams"]["away"]["name"], team_map),
            "odds_by_bookmaker": odds_by_bookmaker,
            "odds_error": odds_error,
        })
    return enriched


def compute_value_bets(fixtures: list[dict], model: DixonColesModel, edge_threshold: float = 0.05) -> list[dict]:
    results = []
    for fx in fixtures:
        pred = model.predict_match(fx["home_team"], fx["away_team"])
        model_probs = {"H": pred["prob_home"], "D": pred["prob_draw"], "A": pred["prob_away"]}

        for bookmaker_name, local_label in TARGET_BOOKMAKERS.items():
            odds = fx["odds_by_bookmaker"].get(bookmaker_name)
            if not odds:
                continue  # this bookmaker didn't have a price on this fixture - skip, don't guess

            implied, overround = devig_1x2(*odds)
            implied_probs = {"H": implied[0], "D": implied[1], "A": implied[2]}

            edges = {k: model_probs[k] - implied_probs[k] for k in ("H", "D", "A")}
            best_side = max(edges, key=edges.get)

            # A team the model has never seen (unmapped name, or promoted with
            # no history in the data) is rated from a generic fallback prior.
            # That is not evidence of an edge, so such rows are still stored
            # and shown, but never flagged as value or counted in the record.
            both_known = pred["home_team_known"] and pred["away_team_known"]

            results.append({
                "fixture_id": fx["fixture_id"],
                "local_label": local_label,
                "home_team": fx["home_team"],
                "away_team": fx["away_team"],
                "model_prob_home": model_probs["H"],
                "model_prob_draw": model_probs["D"],
                "model_prob_away": model_probs["A"],
                "implied_prob_home": implied_probs["H"],
                "implied_prob_draw": implied_probs["D"],
                "implied_prob_away": implied_probs["A"],
                "odds_home": odds[0], "odds_draw": odds[1], "odds_away": odds[2],
                "flagged_side": best_side,
                "edge": edges[best_side],
                "is_value": bool(both_known and edges[best_side] >= edge_threshold),
                "home_team_known": pred["home_team_known"],
                "away_team_known": pred["away_team_known"],
            })
    return results


def push_to_supabase(supabase_client, fixtures: list[dict], value_bets: list[dict]) -> None:
    now_iso = dt.datetime.now(dt.timezone.utc).isoformat()
    fixture_rows = [{
        "id": fx["fixture_id"],
        "home_team": fx["home_team"],
        "away_team": fx["away_team"],
        "kickoff_at": fx["kickoff_at"],
        "status": "scheduled",
        "updated_at": now_iso,
    } for fx in fixtures]
    supabase_client.upsert("fixtures", fixture_rows, on_conflict="id")

    value_bet_rows = [{
        "fixture_id": vb["fixture_id"],
        "local_label": vb["local_label"],
        "model_prob_home": vb["model_prob_home"],
        "model_prob_draw": vb["model_prob_draw"],
        "model_prob_away": vb["model_prob_away"],
        "implied_prob_home": vb["implied_prob_home"],
        "implied_prob_draw": vb["implied_prob_draw"],
        "implied_prob_away": vb["implied_prob_away"],
        "odds_home": vb["odds_home"], "odds_draw": vb["odds_draw"], "odds_away": vb["odds_away"],
        "flagged_side": vb["flagged_side"],
        "edge": vb["edge"],
        "is_value": vb["is_value"],
        "computed_at": now_iso,
    } for vb in value_bets]
    supabase_client.upsert("value_bets", value_bet_rows, on_conflict="fixture_id,local_label")


def weekly_refresh(
    league: League,
    api_client: APISportsClient,
    supabase_client,
    model: DixonColesModel,
    season: int,
    edge_threshold: float = 0.05,
    days_ahead: int = 8,
) -> dict:
    fixtures = fetch_upcoming_fixtures_with_odds(api_client, league, season, days_ahead)
    value_bets = compute_value_bets(fixtures, model, edge_threshold)
    push_to_supabase(supabase_client, fixtures, value_bets)

    unknown_teams = sorted({
        team for fx in fixtures for team in (fx["home_team"], fx["away_team"])
        if not model.is_known_team(team)
    })
    if unknown_teams:
        print(
            "WARNING: the model has no history for: " + ", ".join(unknown_teams) + ". "
            "If any of these is an established club, config/team_map.yaml is missing an entry "
            "for its api-sports.io name. Matches involving them are shown but never flagged as value."
        )
    return {
        "n_fixtures": len(fixtures),
        "n_value_bets_flagged": sum(1 for vb in value_bets if vb["is_value"]),
        "n_odds_rows_computed": len(value_bets),
        "n_fixtures_without_odds": sum(1 for fx in fixtures if not fx["odds_by_bookmaker"]),
        "n_odds_errors": sum(1 for fx in fixtures if fx.get("odds_error")),
        "unknown_teams": unknown_teams,
    }
