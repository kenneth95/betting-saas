"""
Deliberately minimal - talks to Supabase's PostgREST API directly instead
of adding the supabase-py dependency. Uses the service role key, so this
must only ever run server-side (GitHub Actions, a cron job) - never ship
this key to the frontend.

upsert() is for writing COMPLETE rows. To change a few columns of an
existing row (e.g. marking a bet won/lost) use update(): a partial upsert
is rejected by Postgres because the INSERT half of INSERT ... ON CONFLICT
is checked against NOT NULL columns before the conflict is detected.
"""
from __future__ import annotations

from typing import Optional

import requests


def _raise_for_status(resp: requests.Response) -> None:
    """Like raise_for_status(), but keeps PostgREST's error body - the part that says WHY."""
    if resp.ok:
        return
    raise requests.HTTPError(
        f"{resp.status_code} {resp.reason} for {resp.request.method} {resp.url}: {resp.text[:500]}",
        response=resp,
    )


class SupabaseClient:
    def __init__(self, url: str, service_role_key: str, session: Optional[requests.Session] = None):
        self.url = url.rstrip("/")
        self.key = service_role_key
        self.session = session or requests.Session()

    def _headers(self, prefer: str = "resolution=merge-duplicates,return=minimal") -> dict:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": prefer,
        }

    def upsert(self, table: str, rows: list[dict], on_conflict: str) -> None:
        if not rows:
            return
        resp = self.session.post(
            f"{self.url}/rest/v1/{table}",
            headers=self._headers(),
            params={"on_conflict": on_conflict},
            json=rows,
            timeout=30,
        )
        _raise_for_status(resp)

    def update(self, table: str, filters: dict, values: dict) -> int:
        """
        PATCH the rows matching `filters` (PostgREST syntax, e.g.
        {"fixture_id": "eq.7", "local_label": "eq.betika"}) with `values`.
        Returns how many rows were changed. Refuses to run with no filters -
        an unfiltered PATCH would rewrite the whole table.
        """
        if not filters:
            raise ValueError("update() requires at least one filter")
        resp = self.session.patch(
            f"{self.url}/rest/v1/{table}",
            headers=self._headers(prefer="return=representation"),
            params=filters,
            json=values,
            timeout=30,
        )
        _raise_for_status(resp)
        return len(resp.json())

    def select(self, table: str, params: Optional[dict] = None) -> list[dict]:
        """Thin wrapper over PostgREST's filter syntax, e.g.
        select("fixtures", {"status": "eq.scheduled", "select": "id,home_team"})."""
        resp = self.session.get(
            f"{self.url}/rest/v1/{table}",
            headers={"apikey": self.key, "Authorization": f"Bearer {self.key}"},
            params=params or {},
            timeout=30,
        )
        _raise_for_status(resp)
        return resp.json()
