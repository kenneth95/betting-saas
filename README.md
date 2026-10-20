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

**Update (this pass):** payments, results scoring and the weekly pipeline were
hardened and the frontend finished - see "What changed" below. Re-run
`betting_model/supabase/schema.sql` on any existing Supabase project: it now
creates tables before policies (fresh installs used to fail) and adds the
`complete_payment()` function the payment flow depends on.

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

## What changed in the latest pass

**Bugs fixed**
- `schema.sql` failed on a fresh project (a policy referenced `subscriptions` before it existed).
- Results scoring used a partial upsert on `value_bets`, which Postgres rejects, so the track record could never populate. It now uses PATCH updates, settles bets *before* marking the fixture finished (self-healing on failure), voids cancelled/abandoned matches, and widens its lookback to the oldest unscored fixture.
- The weekly refresh could overwrite pre-match odds with live odds and reset finished fixtures to "scheduled" if re-run after kickoff. It now only touches not-started fixtures.
- Payments: access is granted by one atomic database function (`complete_payment`), shared by the webhook and a polling fallback, so a failed write can't leave a paid user locked out and retries can't double-grant. Transient failures return 500 so Paystack retries. Checkout no longer leaks provider errors to the browser and ignores double-taps.

**Added**
- Model: matches involving teams the model has never seen are shown but never flagged as value; API pagination + rate-limit backoff; per-fixture error isolation; a `refit_model.yml` workflow (Mondays) that downloads new results and commits refreshed ratings.
- Frontend: `/account` page (membership, days left, payment history), post-payment confirmation, price on the pricing page, rewritten picks browser (correct model-vs-book bars, sort by best edge, mobile bar no longer covers content), profit/units on the track record, full sitemap.
- `npm run launch-check` lists everything still needed before launch (business details, helpline, legal review).
- Tests: backend 37 (`pytest`), web `npm test`.
