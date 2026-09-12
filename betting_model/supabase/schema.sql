-- Run this in the Supabase SQL editor once, before the first pipeline run.

create table if not exists fixtures (
  id bigint primary key,               -- api-sports.io fixture id
  home_team text not null,
  away_team text not null,
  kickoff_at timestamptz not null,
  status text not null default 'scheduled',  -- 'scheduled' | 'finished'
  result text,                          -- 'H' | 'D' | 'A', filled in once finished
  updated_at timestamptz not null default now()
);

create table if not exists value_bets (
  fixture_id bigint not null references fixtures(id) on delete cascade,
  local_label text not null,            -- 'sportpesa' | 'betika' | 'other'
  model_prob_home numeric not null,
  model_prob_draw numeric not null,
  model_prob_away numeric not null,
  implied_prob_home numeric not null,
  implied_prob_draw numeric not null,
  implied_prob_away numeric not null,
  odds_home numeric not null,
  odds_draw numeric not null,
  odds_away numeric not null,
  flagged_side text not null,           -- 'H' | 'D' | 'A' - side with the largest edge
  edge numeric not null,
  is_value boolean not null,            -- edge >= your configured threshold
  won boolean,                          -- null until the fixture finishes and this gets scored
  settled_at timestamptz,
  computed_at timestamptz not null default now(),
  primary key (fixture_id, local_label)
);

-- Frontend reads through Supabase's anon key with row-level security, so
-- lock these down: no public writes, reads gated by your paid/free tier
-- logic at the application layer (or via RLS policies keyed off a
-- subscriptions table, once you build that).
alter table fixtures enable row level security;
alter table value_bets enable row level security;

create policy "fixtures are publicly readable" on fixtures
  for select using (true);

create policy "value_bets are publicly readable" on value_bets
  for select using (true);

-- No insert/update/delete policies for the anon role - only the service
-- role key (used by the weekly pipeline, never shipped to the frontend)
-- can write, since it bypasses RLS by default.

-- Auth + payments, added when wiring up real subscriptions.
-- auth.users is Supabase's built-in table - these reference it directly.

create table if not exists subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'none',        -- 'none' | 'active' | 'expired'
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  api_ref text not null unique,               -- this IS the Paystack transaction reference
  amount numeric not null,
  currency text not null default 'KES',
  status text not null default 'pending',     -- 'pending' | 'completed' | 'failed'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table subscriptions enable row level security;
alter table payments enable row level security;

create policy "users can read their own subscription" on subscriptions
  for select using (auth.uid() = user_id);

create policy "users can read their own payments" on payments
  for select using (auth.uid() = user_id);

-- No insert/update/delete policy for authenticated or anon roles on either
-- table - only the service role key (used in the checkout and webhook API
-- routes, never sent to the browser) can write, since it bypasses RLS.
