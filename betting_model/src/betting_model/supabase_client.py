"""
Deliberately minimal - talks to Supabase's PostgREST API directly instead
of adding the supabase-py dependency, since all this pipeline needs is
upsert. Uses the service role key, so this must only ever run server-side
(GitHub Actions, a cron job) - never ship this key to the frontend.
"""
from __future__ import annotations

from typing import Optional

import requests


class SupabaseClient:
    def __init__(self, url: str, service_role_key: str, session: Optional[requests.Session] = None):
        self.url = url.rstrip("/")
        self.key = service_role_key
        self.session = session or requests.Session()

    def _headers(self) -> dict:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
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
        resp.raise_for_status()

    def select(self, table: str, params: Optional[dict] = None) -> list[dict]:
        """Thin wrapper over PostgREST's filter syntax, e.g.
        select("fixtures", {"status": "eq.scheduled", "select": "id,home_team"})."""
        resp = self.session.get(
            f"{self.url}/rest/v1/{table}",
            headers={"apikey": self.key, "Authorization": f"Bearer {self.key}"},
            params=params or {},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()
