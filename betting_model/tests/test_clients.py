import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import pytest
import requests

from betting_model.api_sports_client import APISportsClient
from betting_model.supabase_client import SupabaseClient


class FakeResponse:
    def __init__(self, payload=None, status_code=200, headers=None):
        self._payload, self.status_code, self.headers = payload, status_code, headers or {}
        self.ok = status_code < 400
        self.reason = "ERR" if status_code >= 400 else "OK"
        self.text = str(payload)
        self.url = "https://example.test"
        self.request = type("R", (), {"method": "GET"})()

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}", response=self)


class ScriptedSession:
    """Returns queued responses in order and records every call."""
    def __init__(self, responses):
        self.responses, self.calls = list(responses), []

    def _next(self, method, url, **kwargs):
        self.calls.append({"method": method, "url": url, **kwargs})
        return self.responses.pop(0)

    def get(self, url, **kw): return self._next("GET", url, **kw)
    def post(self, url, **kw): return self._next("POST", url, **kw)
    def patch(self, url, **kw): return self._next("PATCH", url, **kw)


def _page(items, current, total):
    return FakeResponse({"errors": [], "response": items, "paging": {"current": current, "total": total}})


def test_api_client_follows_pagination():
    session = ScriptedSession([_page([1, 2], 1, 3), _page([3], 2, 3), _page([4], 3, 3)])
    client = APISportsClient("key", session=session, sleep=lambda s: None)
    assert client.get_odds(1) == [1, 2, 3, 4]
    assert [c["params"].get("page") for c in session.calls] == [None, 2, 3]


def test_api_client_backs_off_and_retries_on_rate_limit():
    limited = FakeResponse({"errors": {"rateLimit": "Too many requests"}, "response": []})
    session = ScriptedSession([FakeResponse(status_code=429), limited, _page(["ok"], 1, 1)])
    sleeps = []
    client = APISportsClient("key", session=session, sleep=sleeps.append)
    assert client.get_fixtures(39, 2026, "2026-09-01", "2026-09-08") == ["ok"]
    assert len(sleeps) == 2 and sleeps[1] > sleeps[0]


def test_api_client_gives_up_after_max_attempts():
    limited = lambda: FakeResponse({"errors": {"rateLimit": "slow down"}, "response": []})
    session = ScriptedSession([limited() for _ in range(10)])
    client = APISportsClient("key", session=session, sleep=lambda s: None)
    with pytest.raises(RuntimeError):
        client.get_odds(1)


def test_api_client_raises_on_other_api_errors():
    session = ScriptedSession([FakeResponse({"errors": {"token": "bad key"}, "response": []})])
    with pytest.raises(RuntimeError):
        APISportsClient("key", session=session, sleep=lambda s: None).get_odds(1)


def test_supabase_update_patches_with_filters_and_returns_row_count():
    session = ScriptedSession([FakeResponse([{"id": 1}, {"id": 2}])])
    client = SupabaseClient("https://x.supabase.co/", "svc", session=session)
    n = client.update("value_bets", {"fixture_id": "eq.1"}, {"won": True})
    assert n == 2
    call = session.calls[0]
    assert call["method"] == "PATCH" and call["url"].endswith("/rest/v1/value_bets")
    assert call["params"] == {"fixture_id": "eq.1"} and call["json"] == {"won": True}


def test_supabase_update_refuses_unfiltered_patch():
    client = SupabaseClient("https://x.supabase.co", "svc", session=ScriptedSession([]))
    with pytest.raises(ValueError):
        client.update("value_bets", {}, {"won": True})


def test_supabase_errors_include_the_postgrest_body():
    session = ScriptedSession([FakeResponse({"message": "null value in column"}, status_code=400)])
    client = SupabaseClient("https://x.supabase.co", "svc", session=session)
    with pytest.raises(requests.HTTPError) as exc:
        client.upsert("value_bets", [{"a": 1}], on_conflict="a")
    assert "null value in column" in str(exc.value)
