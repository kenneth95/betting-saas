-- Run this in the Supabase SQL editor. Safe to re-run: every statement is
-- idempotent, so re-running it on an existing project just applies upgrades.
--
-- ORDER MATTERS: the value_bets read policy (further down) queries
-- `subscriptions`, so every table is created before any policy is.

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists fixtures (
  id bigint primary key,               -- api-sports.io fixture id
  home_team text not null,
  away_team text not null,
  kickoff_at timestamptz not null,
  status text not null default 'scheduled',  -- 'scheduled' | 'finished' | 'void' (cancelled/abandoned/awarded)
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
  is_value boolean not null,            -- edge >= threshold AND the model knows both teams
  won boolean,                          -- null until the fixture finishes and this gets scored
  settled_at timestamptz,
  computed_at timestamptz not null default now(),
  primary key (fixture_id, local_label)
);

-- Auth + payments. auth.users is Supabase's built-in table.

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

-- ---------------------------------------------------------------------
-- Indexes for the queries the app actually runs
-- ---------------------------------------------------------------------

create index if not exists fixtures_status_kickoff_idx on fixtures (status, kickoff_at);
create index if not exists value_bets_track_record_idx on value_bets (settled_at desc) where is_value and won is not null;
create index if not exists payments_user_created_idx on payments (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------

alter table fixtures enable row level security;
alter table value_bets enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;

drop policy if exists "fixtures are publicly readable" on fixtures;
create policy "fixtures are publicly readable" on fixtures
  for select using (true);

-- Paid content. Settled bets are public (that's the track record page);
-- anything not yet settled is only readable by users with an active
-- subscription. The free-tier preview is read server-side with the service
-- role (see web/lib/data.ts), so it doesn't depend on this policy. Without
-- this, anyone with the public anon key could query upcoming picks straight
-- from Supabase's REST API.
drop policy if exists "value_bets are publicly readable" on value_bets;
drop policy if exists "settled or subscribed value_bets are readable" on value_bets;
create policy "settled or subscribed value_bets are readable" on value_bets
  for select using (
    won is not null
    or exists (
      select 1 from subscriptions s
      where s.user_id = auth.uid()
        and s.status = 'active'
        and s.current_period_end > now()
    )
  );

drop policy if exists "users can read their own subscription" on subscriptions;
create policy "users can read their own subscription" on subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "users can read their own payments" on payments;
create policy "users can read their own payments" on payments
  for select using (auth.uid() = user_id);

-- No insert/update/delete policy for anon or authenticated on any table -
-- only the service role key (weekly pipeline, checkout + webhook routes;
-- never shipped to the browser) can write, since it bypasses RLS.

-- ---------------------------------------------------------------------
-- Atomic payment settlement
-- ---------------------------------------------------------------------
-- Called by the web app (service role only) once Paystack has confirmed a
-- payment. In ONE transaction it (1) claims the payment pending -> completed
-- and (2) extends the user's subscription. Doing both together means:
--   * a crash between the two steps can't leave a paid user without access;
--   * two concurrent calls (webhook retry + the status poll) can't both
--     claim the same payment, so days are never granted twice;
--   * early renewals stack on top of the current expiry.
-- Returns the new period end, or NULL if the payment was unknown or had
-- already been completed (i.e. nothing was granted this time).
create or replace function complete_payment(p_reference text, p_days int)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_end timestamptz;
begin
  update payments
     set status = 'completed', updated_at = now()
   where api_ref = p_reference and status = 'pending'
   returning user_id into v_user;

  if v_user is null then
    return null;
  end if;

  insert into subscriptions (user_id, status, current_period_end, updated_at)
  values (v_user, 'active', now() + make_interval(days => p_days), now())
  on conflict (user_id) do update
    set status = 'active',
        current_period_end = greatest(subscriptions.current_period_end, now()) + make_interval(days => p_days),
        updated_at = now()
  returning current_period_end into v_end;

  return v_end;
end;
$$;

revoke all on function complete_payment(text, int) from public, anon, authenticated;
grant execute on function complete_payment(text, int) to service_role;
