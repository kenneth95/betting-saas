"""
Download the current season's results for a league from football-data.co.uk
into data/raw/<league>/, so the scheduled refit has fresh matches to learn from.

Usage:
    python scripts/update_data.py --league epl
    python scripts/update_data.py --league epl --season 2026

The file is saved as <code>_<season slug>.csv (e.g. E0_2627.csv for 2026/27)
and replaced in place on each run - football-data.co.uk appends to the same
file all season. The download is validated before it replaces anything, so a
failed or truncated download can never corrupt the data folder.

Exit codes: 0 = updated (or nothing to do), 1 = download/validation failed.
"""
import argparse
import sys
from pathlib import Path
from typing import Optional

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from betting_model import get_league, current_season, load_season_csv
from betting_model.config import League

BASE = "https://www.football-data.co.uk/mmz4281"


def season_slug(season: int) -> str:
    """2026 (the 2026/27 season) -> '2627', football-data.co.uk's folder naming."""
    return f"{season % 100:02d}{(season + 1) % 100:02d}"


def update_current_season(league: League, season: int, session: Optional[requests.Session] = None) -> Path:
    if not league.football_data_code:
        raise ValueError(f"League '{league.code}' has no football_data_code in config/leagues.yaml")

    slug = season_slug(season)
    url = f"{BASE}/{slug}/{league.football_data_code}.csv"
    resp = (session or requests).get(url, timeout=30)
    resp.raise_for_status()

    league.data_path.mkdir(parents=True, exist_ok=True)
    target = league.data_path / f"{league.football_data_code}_{slug}.csv"
    tmp = target.with_suffix(".csv.tmp")
    tmp.write_bytes(resp.content)
    try:
        matches = load_season_csv(str(tmp))  # raises if columns are missing / file is junk
    except Exception:
        tmp.unlink(missing_ok=True)
        raise
    if matches.empty:
        # Normal in the first days of a season, before a ball has been kicked.
        tmp.unlink(missing_ok=True)
        print(f"{url} has no completed matches yet - nothing to update.")
        return target
    tmp.replace(target)
    print(f"Saved {len(matches)} matches to {target}")
    return target


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--league", required=True)
    parser.add_argument("--season", type=int, default=None, help="Start year of the season; defaults to the current one.")
    args = parser.parse_args()

    league = get_league(args.league)
    season = args.season if args.season is not None else current_season()
    try:
        update_current_season(league, season)
    except Exception as exc:
        print(f"Data update failed: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
