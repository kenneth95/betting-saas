"""
Minimal client for the api-sports.io (API-Football) endpoints this
pipeline needs: fixtures and odds. Deliberately thin: it handles the two
transport concerns that belong at this layer (following `paging`, and
backing off when the plan's requests-per-minute limit is hit) and nothing
else - no caching, no business logic.
"""
from __future__ import annotations

import time
from typing import Callable, Optional

import requests

BASE_URL = "https://v3.football.api-sports.io"
MAX_PAGES = 10          # safety cap on paginated endpoints
MAX_ATTEMPTS = 4        # tries per request when rate-limited
RETRY_BASE_SECONDS = 7  # free plan allows ~10 requests/minute, so back off in multiples of this


def _is_rate_limited(errors) -> bool:
    # api-sports.io reports an exceeded rate limit as HTTP 200 with an
    # `errors` object like {"rateLimit": "Too many requests..."}.
    return isinstance(errors, dict) and "rateLimit" in errors


class APISportsClient:
    def __init__(self, api_key: str, session: Optional[requests.Session] = None, base_url: str = BASE_URL,
                 sleep: Callable[[float], None] = time.sleep):
        self.api_key = api_key
        self.session = session or requests.Session()
        self.base_url = base_url
        self._sleep = sleep
        self.last_response_headers: dict = {}

    def _request(self, path: str, params: dict) -> dict:
        """One logical request, retried with backoff when the API says we're going too fast."""
        headers = {"x-apisports-key": self.api_key}
        for attempt in range(1, MAX_ATTEMPTS + 1):
            resp = self.session.get(f"{self.base_url}{path}", headers=headers, params=params, timeout=15)
            self.last_response_headers = resp.headers
            if resp.status_code == 429 and attempt < MAX_ATTEMPTS:
                self._sleep(RETRY_BASE_SECONDS * attempt)
                continue
            resp.raise_for_status()
            data = resp.json()
            errors = data.get("errors")
            if _is_rate_limited(errors) and attempt < MAX_ATTEMPTS:
                self._sleep(RETRY_BASE_SECONDS * attempt)
                continue
            if errors:
                raise RuntimeError(f"api-sports.io returned errors: {errors}")
            return data
        raise RuntimeError("unreachable")  # pragma: no cover

    def _get(self, path: str, params: Optional[dict] = None) -> list:
        """Returns the `response` array, following api-sports.io's `paging` across pages."""
        params = dict(params or {})
        results: list = []
        page = 1
        while True:
            page_params = {**params, "page": page} if page > 1 else params
            data = self._request(path, page_params)
            results.extend(data["response"])
            total_pages = (data.get("paging") or {}).get("total") or 1
            if page >= total_pages or page >= MAX_PAGES:
                break
            page += 1
        return results

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
