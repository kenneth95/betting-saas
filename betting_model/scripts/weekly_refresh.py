"""
Usage (needs real credentials as env vars - see .github/workflows/weekly_refresh.yml):
    API_SPORTS_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \\
        python scripts/weekly_refresh.py --league epl

Assumes you've already run fit_and_predict.py at least once for this
league so a saved model exists at models/<league>/latest.json. This
script predicts from that saved model - it does not refit. Re-run
fit_and_predict.py periodically (e.g. after each round of results comes
in) to keep ratings current.
"""
import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from betting_model import get_league, current_season, DixonColesModel, APISportsClient, SupabaseClient, weekly_refresh


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--league", required=True)
    parser.add_argument("--season", type=int, default=None,
                        help="api-sports.io season (the year it starts in). Defaults to the current season.")
    parser.add_argument("--days-ahead", type=int, default=8)
    parser.add_argument("--edge-threshold", type=float, default=0.05)
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
    model = DixonColesModel.load(league.model_path)

    summary = weekly_refresh(
        league, api_client, supabase_client, model,
        season=season, edge_threshold=args.edge_threshold, days_ahead=args.days_ahead,
    )
    print(summary)
    print(f"api-sports.io requests remaining today: {api_client.remaining_requests_today()}")


if __name__ == "__main__":
    main()
