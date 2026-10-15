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

Deploy on Vercel: connect the repo (root directory: `web`) and set every
variable from `.env.local.example` in the project settings:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`.
The homepage's free-tier preview and the payment routes read with the
service role key, so the site will show no fixtures without it.

## Deploy to Vercel

1. **Push the repo to GitHub**, then in Vercel: *Add New → Project → import it*.
   Set **Root Directory to `web`** (the repo root holds both the Python model
   and this app). Framework preset is detected as Next.js; `vercel.json` pins it.
2. **Environment variables** (Project → Settings → Environment Variables,
   enable for Production *and* Preview):

   | Variable | Where to get it |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (server-only - never prefix with `NEXT_PUBLIC_`) |
   | `PAYSTACK_SECRET_KEY` | Paystack → Settings → API Keys (`sk_test_...` until you've tested) |
   | `NEXT_PUBLIC_APP_URL` | Optional. Your custom domain, no trailing slash. Falls back to Vercel's own URL. |

   Without the Supabase vars the site still loads, but shows no fixtures.
3. **Deploy**, then in Supabase → Authentication → URL Configuration set the
   *Site URL* to your production URL and add `https://<your-domain>/auth/callback`
   (and `https://*.vercel.app/auth/callback` if you want magic links to work on
   preview deployments) to *Redirect URLs*.
4. **Paystack webhook**: set it to `https://<your-domain>/api/webhooks/paystack`.
5. Put the Vercel project's region near your Supabase region to keep the
   fixtures query fast (Project → Settings → Functions).

Local check before pushing: `npm install && npm run typecheck && npm run build`.

## What's real vs. placeholder right now

**Real**: the data layer (`lib/data.ts`) reads live from Supabase using
the public anon key, gated by row-level security. Auth (magic-link
sign-in via Supabase), the subscription check (`lib/subscription.ts`),
and the M-Pesa payment flow (`/api/checkout` → Paystack STK push →
`/api/webhooks/paystack` → subscription activated) are wired end-to-end.
`npm run build` passes clean with all of it in place.

**Not yet done**: I could not test a real payment or webhook delivery
from this environment (no network access to paystack.co or a live
Supabase project). Do one real sandbox payment yourself before trusting
this in production - see the payments section below.

## Auth + subscriptions + M-Pesa payments (via Paystack)

**How it works:**
1. User signs in via a magic link (`/login` → Supabase sends an email →
   `/auth/callback` exchanges the code for a session). No passwords to
   manage.
2. `/upgrade` (auth-gated, redirects to `/login` if signed out) collects
   an M-Pesa phone number and posts to `/api/checkout`.
3. `/api/checkout` (accepts `0712 345 678`, `+254...`, etc.) records a `pending` row in the `payments` table, then
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
6. After the prompt is sent, the upgrade form polls `/api/subscription-status` and redirects to the picks page as soon as the webhook activates the subscription.
7. `lib/subscription.ts` checks `subscriptions.current_period_end` on
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

**Pricing**: `WEEKLY_PRICE_KES` and `SUBSCRIPTION_DAYS` live in
`lib/site.ts` and drive the checkout charge, the webhook, and all the
on-page copy - change them there only.

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
rows show a plain muted line rather than a blurred-card overlay. The
free tier is the first `FREE_TIER_VISIBLE_COUNT` (2) fixtures; locked
fixtures have their picks stripped on the server before rendering, and
`value_bets` is also protected by an RLS policy (see
`betting_model/supabase/schema.sql`) so the public anon key can't read
upcoming picks directly.

Verified this builds cleanly (`npm run build`) with valid types and no
webpack errors. I could not verify the Google Fonts fetch or an actual
Supabase connection from my sandbox (both are blocked by my environment's
network allowlist) - Vercel's build servers won't have that restriction,
but do a `npm run build` yourself once real env vars are in place before
your first deploy, just to be sure.
