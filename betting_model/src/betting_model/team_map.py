"""
api-sports.io and football-data.co.uk name the same teams differently
(e.g. "Manchester United" vs "Man United"). The model's team ratings are
keyed by whatever name appeared in your training CSVs (football-data.co.uk
names), so incoming api-sports.io fixtures need translating before you
call predict_match() - otherwise "Manchester United" looks like a brand
new, never-seen team every single week.
"""
from __future__ import annotations

from pathlib import Path

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def load_team_map(league_code: str, config_path: Path = None) -> dict[str, str]:
    config_path = config_path or (PROJECT_ROOT / "config" / "team_map.yaml")
    with open(config_path) as f:
        raw = yaml.safe_load(f) or {}
    return raw.get(league_code, {})


def map_team_name(league_code: str, api_sports_name: str, team_map: dict[str, str] = None) -> str:
    team_map = team_map if team_map is not None else load_team_map(league_code)
    return team_map.get(api_sports_name, api_sports_name)  # unmapped names pass through unchanged
