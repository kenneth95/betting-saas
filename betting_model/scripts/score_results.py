"""
Usage:
    API_SPORTS_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \\
        python scripts/score_results.py --league epl

Run this daily, not weekly - matches finish throughout the week, and the
sooner a result gets scored, the sooner it shows up on the track record
page. See .github/workflows/score_results.yml.
"""
import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from betting_model import get_league, current_season, APISportsClient, SupabaseClient, score_recent_fixtures


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--league", required=True)
    parser.add_argument("--season", type=int, default=None,
                        help="api-sports.io season (the year it starts in). Defaults to the current season.")
    parser.add_argument("--lookback-days", type=int, default=10)
    args = parser.parse_args()

    league = get_league(args.league)
    season = args.season if args.season is not None else current_season()
    print(f"Using season {season}")

    required_env = ["API_SPORTS_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    missing = [v for v in required_env if not os.environ.get(v)]
    if missing:
        print(f"Missing required environment variables: {missing}")
        sys.exit(1)

    api_client = APISportsClient(api_key=os.environ["API_SPORTS_KEY"])
    supabase_client = SupabaseClient(
        url=os.environ["SUPABASE_URL"],
        service_role_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    summary = score_recent_fixtures(api_client, supabase_client, league, season, args.lookback_days)
    print(summary)
    print(f"api-sports.io requests remaining today: {api_client.remaining_requests_today()}")
    if summary["n_errors"]:
        sys.exit(f"{summary['n_errors']} fixture(s) could not be scored - see log above.")


if __name__ == "__main__":
    main()
