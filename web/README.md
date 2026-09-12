# Weekly picks frontend

Next.js (App Router) app that reads `fixtures` + `value_bets` from
Supabase (written weekly by the `betting_model` pipeline) and renders
this week's Premier League predictions vs. Kenyan bookmaker odds.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

Deploy on Vercel: connect the repo, set the same two env vars
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the
project settings, done. No other config needed.

## What's real vs. placeholder right now

**Real**: the data layer (`lib/data.ts`) reads live from Supabase using
the public anon key, gated by row-level security. Auth (magic-link
sign-in via Supabase), the subscription check (`lib/subscription.ts`),
and the M-Pesa payment flow (`/api/checkout` → IntaSend STK push →
`/api/webhooks/intasend` → subscription activated) are wired end-to-end.
`npm run build` passes clean with all of it in place.

**Not yet done**: I could not test a real payment or webhook delivery
from this environment (no network access to intasend.com or a live
Supabase project). Do one real sandbox payment yourself before trusting
this in production - see the payments section below.

## Auth + subscriptions + M-Pesa payments (via Paystack)

**How it works:**
1. User signs in via a magic link (`/login` → Supabase sends an email →
   `/auth/callback` exchanges the code for a session). No passwords to
   manage.
2. `/upgrade` (auth-gated, redirects to `/login` if signed out) collects
   an M-Pesa phone number and posts to `/api/checkout`.
3. `/api/checkout` records a `pending` row in the `payments` table, then
   calls Paystack's Charge API with a `mobile_money` object
   (`provider: "mpesa"`) to trigger an STK push to that phone.
4. The user enters their M-Pesa PIN. Paystack calls
   `/api/webhooks/paystack` with a `charge.success` or `charge.failed`
   event.
5. The webhook handler verifies the `x-paystack-signature` header (a real
   HMAC-SHA512 signature over the raw request body, keyed with your
   secret key) before trusting anything in the payload - then, as a
   second check, re-fetches the transaction status directly from
   Paystack's `/transaction/verify/:reference` endpoint rather than
   relying solely on the webhook body. Belt and braces: the signature
   check alone is solid, but re-verifying against the source of truth
   costs one API call and closes off an entire class of "what if the
   event body is misleading" bugs.
6. `lib/subscription.ts` checks `subscriptions.current_period_end` on
   every homepage load to decide what a signed-in user can see.

**The one gotcha that costs real money if you miss it**: Paystack expects
amounts in the smallest currency unit - for KES, that's **cents, not
shillings**. `WEEKLY_PRICE_KES * 100` in `app/api/checkout/route.ts` is
not a typo. Get this wrong and you either charge customers 100x too much
or 100x too little.

**Setup:**
1. Run the updated `betting_model/supabase/schema.sql` (it now includes
   `subscriptions` and `payments` tables) in your Supabase SQL editor.
2. In Supabase Auth settings, make sure email OTP/magic link sign-in is
   enabled (it is by default) and set your site URL / redirect URLs to
   include `<your-app-url>/auth/callback`.
3. Create a Paystack account, verify it for Kenya/mobile money support,
   and grab your secret key from Settings → API Keys & Webhooks. Set
   `PAYSTACK_SECRET_KEY` in `.env.local.example` — use the `sk_test_...`
   key while testing.
4. In Paystack's dashboard, set your webhook URL to
   `<your-app-url>/api/webhooks/paystack`. No separate shared secret to
   configure - Paystack signs with your existing secret key.
5. **Test with your `sk_test_` key first** before switching to
   `sk_live_...`. Paystack uses a single API host for both; the key
   prefix is what determines test vs. live.
6. Before going live, double-check the Charge API's request/response
   shape for Kenyan mobile money against Paystack's current docs - I
   reconstructed the integration in `app/api/checkout/route.ts` and
   `app/api/webhooks/paystack/route.ts` from their public documentation,
   not a live call, since I don't have network access to paystack.co from
   this environment.

**Pricing**: currently hardcoded as `WEEKLY_PRICE_KES = 150` in
`app/api/checkout/route.ts` - change it there, and update the copy in
`app/upgrade/page.tsx` to match.

## Structure

```
web/
├── middleware.ts               # refreshes the Supabase session cookie every request
├── app/
│   ├── layout.tsx               # fonts + global styles
│   ├── page.tsx                 # the weekly picks page, gated by real subscription status
│   ├── login/page.tsx           # magic-link sign-in
│   ├── auth/callback/route.ts   # exchanges the magic-link code for a session
│   ├── upgrade/page.tsx         # auth-gated, renders the M-Pesa checkout form
│   ├── api/checkout/route.ts    # starts the Paystack M-Pesa STK push
│   ├── api/webhooks/paystack/route.ts  # verifies signature, confirms payment, activates subscription
│   └── globals.css
├── components/
│   ├── FixtureRow.tsx           # one match's odds-board row, locked or unlocked
│   ├── ProbTrio.tsx             # home/draw/away probability display
│   └── UpgradeForm.tsx          # the M-Pesa phone number form
└── lib/
    ├── supabase/
    │   ├── browser.ts           # client-side Supabase client
    │   ├── server.ts            # server-side client, user's own session (RLS applies)
    │   └── service.ts           # service-role client, bypasses RLS - API routes only
    ├── subscription.ts          # checks current_period_end against now
    ├── data.ts                  # the weekly fixtures query
    └── types.ts
```


## Design notes

Built as an odds-board ledger (thin dividers, tabular numerals, dense
rows) rather than a grid of rounded shadow cards, since the audience is
scanning numbers quickly on mobile, not browsing a marketing page. Locked
rows show a plain muted line rather than a blurred-card overlay - once
you wire up real subscriptions, that's the line to swap for an actual
"you have N of M fixtures" or similar, rather than the current flat
`index >= 2` placeholder.

Verified this builds cleanly (`npm run build`) with valid types and no
webpack errors. I could not verify the Google Fonts fetch or an actual
Supabase connection from my sandbox (both are blocked by my environment's
network allowlist) - Vercel's build servers won't have that restriction,
but do a `npm run build` yourself once real env vars are in place before
your first deploy, just to be sure.
