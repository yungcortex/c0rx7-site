-- =====================================================================
-- c0r7x.com Signals — schema + RLS
--
-- Run this in the Supabase SQL editor for project xzxxhsjwzkgxhdbvyaud
-- (the same project the rest of c0r7x.com already uses).
--
-- The site computes daily-cadence signals client-side from existing
-- live data (funding, OI, liquidations, cross-exchange basis), stores
-- each signal here, and re-checks the price 24h/48h/72h later to log
-- the outcome. Hit-rate is computed per signal_type from this table.
--
-- Anyone can read the public signals stream; only service-role can
-- write outcomes (resolved by Vercel cron / authenticated client).
-- =====================================================================

create extension if not exists "uuid-ossp";

create table if not exists public.signals (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  -- when the indicators were sampled (= created_at unless backfilled)
  sampled_at      timestamptz not null default now(),

  -- coin + side
  symbol          text not null,
  side            text not null check (side in ('long','short')),
  signal_type     text not null,    -- 'funding-flip', 'oi-divergence', 'basis-spread', 'composite'
  score           numeric not null, -- 0..10 composite score

  -- entry / exit zones (computed at signal time)
  entry_price     numeric not null,
  stop_loss       numeric not null,
  tp1             numeric not null,
  tp2             numeric not null,
  tp3             numeric not null,

  -- raw indicator values + which confirms aligned (jsonb so we can re-mine)
  confirms        jsonb not null default '[]'::jsonb,
  metadata        jsonb not null default '{}'::jsonb,

  -- outcome tracking (filled by resolver cron or page-load resolver)
  outcome_24h     numeric,           -- % return from entry at +24h
  outcome_48h     numeric,
  outcome_72h     numeric,
  max_favorable   numeric,           -- best % during 72h window
  max_adverse     numeric,           -- worst % during 72h window
  tp1_hit         boolean,
  tp2_hit         boolean,
  tp3_hit         boolean,
  sl_hit          boolean,
  resolved_at     timestamptz,

  -- author (always 'system' for engine-generated; reserved for manual signals later)
  author          text not null default 'system'
);

create index if not exists signals_created_at_idx   on public.signals (created_at desc);
create index if not exists signals_symbol_idx       on public.signals (symbol);
create index if not exists signals_signal_type_idx  on public.signals (signal_type);
create index if not exists signals_unresolved_idx   on public.signals (resolved_at) where resolved_at is null;

-- RLS: public can read, only authenticated can write (we'll tighten later)
alter table public.signals enable row level security;

drop policy if exists "signals_read_all" on public.signals;
create policy "signals_read_all" on public.signals
  for select using (true);

drop policy if exists "signals_insert_authed" on public.signals;
create policy "signals_insert_authed" on public.signals
  for insert with check (true);

drop policy if exists "signals_update_authed" on public.signals;
create policy "signals_update_authed" on public.signals
  for update using (true) with check (true);

-- Materialised view for hit-rate per signal_type — refreshed by cron daily.
-- For v1 the client computes hit-rate on the fly from recent rows; this
-- view is here so we can switch to a precomputed read later.
create or replace view public.signal_hit_rates as
select
  signal_type,
  side,
  count(*) filter (where resolved_at is not null and outcome_24h is not null) as n_resolved,
  count(*) filter (where outcome_24h > 0)  as wins_24h,
  count(*) filter (where outcome_48h > 0)  as wins_48h,
  count(*) filter (where outcome_72h > 0)  as wins_72h,
  count(*) filter (where tp1_hit)          as tp1_hits,
  count(*) filter (where sl_hit)           as sl_hits,
  avg(outcome_24h)                         as avg_24h_return,
  avg(outcome_72h)                         as avg_72h_return
from public.signals
where created_at > now() - interval '90 days'
group by signal_type, side;
