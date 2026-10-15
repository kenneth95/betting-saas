# Kenyan football value-betting SaaS

A weekly Premier League prediction and value-bet comparison tool for the
Kenyan market: a Dixon-Coles Poisson model predicts match outcomes,
compares them against Kenyan bookmaker odds (via international feeds
they're priced from - see `betting_model/README.md` for the details you
verified), and surfaces where there's a pricing edge.

## Repo layout

```
.
├── betting_model/   # Python: the model, weekly data pipeline, results scoring
│   └── README.md    # full setup + how the model/pipeline work
└── web/             # Next.js frontend: weekly picks, auth, M-Pesa payments, track record
    └── README.md    # full setup + how auth/payments work
```

Start with each subfolder's own README for setup instructions - this file
is just the map. Rough order of operations for a fresh setup:

1. Create your Supabase project, run `betting_model/supabase/schema.sql`.
2. Get your api-sports.io key, drop your EPL historical CSVs into
   `betting_model/data/raw/epl/`, run the backtest, then `fit_and_predict.py`
   once to produce a saved model, and **commit `models/epl/latest.json`** -
   the weekly GitHub Action predicts from the committed fit and fails with
   a clear error if it's missing. Re-fit and re-commit periodically.
3. Set up the GitHub Actions secrets (`API_SPORTS_KEY`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`) in your repo's Settings → Secrets, so the
   weekly refresh and daily results jobs in `.github/workflows/` can run.
4. Deploy `web/` to Vercel, set its env vars, connect it to the same
   Supabase project.
5. Set up Paystack, point its webhook at your deployed app.

## Status

Remaining before launch (needs your accounts/keys, so not done here):
real EPL CSVs + first fit, verifying `config/team_map.yaml` against a live
`/teams` call, one Paystack test-mode payment + webhook, deploy. The
season now defaults to the current one automatically (`current_season()`),
so there's no yearly workflow edit.

Model validated on real EPL data → weekly pipeline → results scoring →
frontend with auth, subscriptions, M-Pesa payments, and a public track
record. Not yet done: a live end-to-end test of the payment and webhook
flow (no network access to Paystack/Supabase from the environment this
was built in - see the caveats in `web/README.md`), and actual deployment.
