# Betting model

League-agnostic Dixon-Coles Poisson model, structured so adding a new
league is a config change, not a code change.

## Folder layout

```
betting_model/
├── config/leagues.yaml     # <- add a league here
├── data/raw/<code>/        # <- drop that league's CSVs here
├── models/<code>/          # fitted ratings + backtest results, generated
├── src/betting_model/      # core package, never references a league name
├── scripts/                # CLIs: fit_and_predict.py, run_backtest.py
└── tests/                  # pytest
```

## Adding a new league

1. Create `data/raw/<code>/` and drop that league's football-data.co.uk
   season CSVs in it (rename them so multiple seasons don't overwrite -
   football-data.co.uk names every EPL file `E0.csv`, every La Liga file
   `SP1.csv`, etc., so add a season suffix yourself).
2. Add an entry to `config/leagues.yaml`:
   ```yaml
   - code: la_liga
     name: La Liga
     data_folder: data/raw/la_liga
     api_sports_league_id: 140
     bookmaker_prefix: null
     model_overrides: {}
   ```
3. Run it:
   ```
   python scripts/fit_and_predict.py --league la_liga
   python scripts/run_backtest.py --league la_liga
   ```

Nothing in `src/betting_model/` changes. `model_overrides` lets you tune
hyperparameters per league if needed (e.g. a smaller league with fewer
matches per season might want more shrinkage — higher `l2_penalty`).

## Day-to-day commands

```bash
# One-time / occasional: fit a league's model and save its ratings
python scripts/fit_and_predict.py --league epl

# Cheap: predict a fixture from the last saved fit, no refitting
python scripts/fit_and_predict.py --league epl --load-only --home Arsenal --away Chelsea

# Validate the model before trusting it: walk-forward backtest
python scripts/run_backtest.py --league epl
```

## Setup

```bash
pip install -r requirements.txt
python scripts/make_synthetic_data.py   # optional: generates a synthetic
                                          # "epl_test" league (already
                                          # registered in leagues.yaml) so
                                          # you can verify everything runs
                                          # before touching real data
python -m pytest tests/                  # run the test suite
```

## Why fit/predict are separated

`DixonColesModel.fit()` runs an optimization over the whole match history
and takes a few seconds. You don't want that happening on every user
request. The pattern is:

- **Fit weekly** (or whenever you pull new results) via
  `fit_and_predict.py`, which saves ratings to `models/<code>/latest.json`.
- **Predict on demand** by loading that saved file (`DixonColesModel.load()`
  or `--load-only`), which is near-instant — no re-optimization.

This is also the shape you'll want once this plugs into the Supabase/Vercel
pipeline: the weekly job fits and writes ratings, your app's prediction
logic just reads them.

## Weekly production pipeline (api-sports.io → Supabase)

```
betting_model/
├── config/team_map.yaml       # api-sports.io name -> football-data.co.uk name
├── supabase/schema.sql        # run once in the Supabase SQL editor
├── src/betting_model/
│   ├── api_sports_client.py   # fixtures + odds from api-sports.io
│   ├── team_map.py
│   ├── supabase_client.py     # thin PostgREST wrapper, upsert only
│   └── pipeline.py            # ties it together: fetch -> predict -> push
└── scripts/weekly_refresh.py  # CLI entry point, run by the GitHub Action
```

**Setup, one-time:**
1. Run `supabase/schema.sql` in your Supabase project's SQL editor.
2. In your GitHub repo settings, add three secrets: `API_SPORTS_KEY`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (the service role key, not
   the anon key — this pipeline writes, so it needs to bypass RLS. Never
   put the service role key in frontend code). The workflow files that use
   them live at the repo root's `.github/workflows/` (`weekly_refresh.yml`
   and `score_results.yml`), not inside this folder, since that's the only
   place GitHub Actions looks for them.
3. Verify `config/team_map.yaml` against a real `/teams` call for your
   league — the mapping shipped here is a best-effort guess based on
   typical naming conventions between api-sports.io and football-data.co.uk,
   not verified against a live response. Wrong mappings fail silently
   (an unmapped team just looks "new" to the model), so check this once
   properly rather than finding out later.
4. Make sure you've run `fit_and_predict.py --league epl` at least once
   so `models/epl/latest.json` exists — the weekly pipeline predicts from
   that saved file, it doesn't fit from scratch.

**Ongoing:** the GitHub Action runs every Monday, pulls the week's
fixtures and Bet365/Betfair/1xBet odds, predicts with your saved model,
computes value bets, and upserts both into Supabase. Re-run
`fit_and_predict.py` periodically (e.g. after each round of results) to
keep the model's ratings current — the weekly pipeline itself never
refits, by design, so it stays fast and cheap.

**What's tested vs. what isn't**: the value-bet computation, odds
extraction, and Supabase upsert shape are covered by `tests/test_pipeline.py`
using fake data — that logic is verified. The actual live calls to
api-sports.io and Supabase are not, since I don't have network access to
either from this environment. Run `scripts/weekly_refresh.py` yourself
against a real (or test) Supabase project before trusting it in the
scheduled Action.

## Keeping the model current

`.github/workflows/refit_model.yml` runs Mondays 04:00 UTC (before the 06:00 weekly
refresh): `scripts/update_data.py` downloads the current season's results from
football-data.co.uk (needs `football_data_code` in `config/leagues.yaml`), the model is
refit, and `models/epl/latest.json` is committed if it changed. The download is validated
before it replaces any data. Teams the model has never seen (e.g. newly promoted) are
shown but never flagged as value, and the weekly job logs a warning naming them - if one
is an established club, add its api-sports.io name to `config/team_map.yaml`.

Tests: `python -m pytest tests/`.

## Caveats carried over from the single-league version

- The synthetic `epl_test` league exists purely to verify the code runs —
  its placeholder odds are not realistic, so its backtest numbers are
  meaningless. Delete it once you trust your real backtests.
- See `src/betting_model/poisson_model.py`'s docstring for the full
  explanation of how promotion/relegation is handled (time decay,
  shrinkage, and the fallback prior for teams with no history at all).
