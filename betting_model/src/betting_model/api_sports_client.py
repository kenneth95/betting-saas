"""
Minimal client for the api-sports.io (API-Football) endpoints this
pipeline needs: fixtures and odds. Deliberately thin - no retry logic or
caching here, that lives in the pipeline layer where it's easier to test.
"""
from __future__ import annotations

from typing import Optional

import requests

BASE_URL = "https://v3.football.api-sports.io"


class APISportsClient:
    def __init__(self, api_key: str, session: Optional[requests.Session] = None, base_url: str = BASE_URL):
        self.api_key = api_key
        self.session = session or requests.Session()
        self.base_url = base_url
        self.last_response_headers: dict = {}

    def _get(self, path: str, params: Optional[dict] = None) -> list:
        headers = {"x-apisports-key": self.api_key}
        resp = self.session.get(f"{self.base_url}{path}", headers=headers, params=params or {}, timeout=15)
        resp.raise_for_status()
        self.last_response_headers = resp.headers
        data = resp.json()
        if data.get("errors"):
            raise RuntimeError(f"api-sports.io returned errors: {data['errors']}")
        return data["response"]

    def get_fixtures(self, league_id: int, season: int, date_from: str, date_to: str) -> list:
        return self._get("/fixtures", {
            "league": league_id, "season": season, "from": date_from, "to": date_to,
        })

    def get_odds(self, fixture_id: int) -> list:
        return self._get("/odds", {"fixture": fixture_id})

    def get_bookmakers(self) -> list:
        """Run this once and check the output before trusting bookmaker name matching elsewhere."""
        return self._get("/odds/bookmakers")

    def remaining_requests_today(self) -> Optional[str]:
        return self.last_response_headers.get("x-ratelimit-requests-remaining")


def extract_1x2_odds(odds_response_item: dict, bookmaker_names: list[str]) -> dict[str, tuple[float, float, float]]:
    """
    Given one item from /odds's response array (one fixture, all
    bookmakers), return {bookmaker_name: (home_odds, draw_odds, away_odds)}
    for whichever of `bookmaker_names` actually have a Match Winner market
    on this fixture.
    """
    result = {}
    for bookmaker in odds_response_item.get("bookmakers", []):
        if bookmaker.get("name") not in bookmaker_names:
            continue
        for bet in bookmaker.get("bets", []):
            if bet.get("name") != "Match Winner":
                continue
            values = {v["value"]: float(v["odd"]) for v in bet.get("values", [])}
            if {"Home", "Draw", "Away"} <= values.keys():
                result[bookmaker["name"]] = (values["Home"], values["Draw"], values["Away"])
    return result
