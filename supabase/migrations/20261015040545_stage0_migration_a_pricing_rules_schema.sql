-- Migration A — pricing rules schema (BRIEF-estimator-pricing-rules-stage0 §3, Stage A).
--
-- FOR THE RECORD ONLY. Already applied to production on 15 Oct 2026 as
-- version 20261015040545; this file's name matches that version, so
-- `supabase db push` treats it as applied. Do not run it again.
--
-- Three new tables plus RLS, and a per-role minimum on rate_cards.
-- The SQL below is §3, verbatim.

-- 1. Double-penalty windows (D31). Recurring, month-day + time, wall-clock Melbourne.
create table public.double_penalty_windows (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,                       -- 'Christmas', 'New Year'
  start_md     text not null check (start_md ~ '^\d{2}-\d{2}$'),   -- '12-24'
  start_time   text not null check (start_time ~ '^\d{2}:\d{2}$'), -- '20:00'
  end_md       text not null check (end_md ~ '^\d{2}-\d{2}$'),     -- '12-25' (or '01-01': next year)
  end_time     text not null check (end_time ~ '^\d{2}:\d{2}$'),   -- '12:00'
  multiplier   numeric not null default 2 check (multiplier > 1),
  is_active    boolean not null default true,
  updated_at   timestamptz not null default now()
);

-- 2. Items that aren't hourly roles (D25 kinds 2 and 3). Charge only.
create table public.rate_items (
  id              uuid primary key default gen_random_uuid(),
  set_id          uuid not null references public.rate_card_sets(id),
  code            text not null,                     -- 'broadcast', 'travel', 'harness_hire', 'tolls'
  name            text not null,
  kind            text not null check (kind in ('per_person_per_event','travel_per_hour','flat_item')),
  charge_ex_gst   numeric,                           -- null = entered at cost (tolls)
  unit_label      text not null,                     -- 'per person per event', 'per hour', 'each'
  effective_from  date not null default '2000-01-01',
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  notes           text,
  updated_at      timestamptz not null default now(),
  unique (set_id, code, effective_from)
);

-- 3. Shared test cases (D33). Self-contained: each case carries its own rates.
create table public.pricing_test_cases (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,                  -- 'C01', 'X01'
  title       text not null,
  rule        text not null,                         -- what it proves: 'midnight split', 'D31 window'
  scope       text not null default 'both' check (scope in ('both','goat')),
  input       jsonb not null,
  expected    jsonb not null,
  is_active   boolean not null default true,
  notes       text,
  updated_at  timestamptz not null default now()
);

-- 4. Per-role minimum (S-3). Null = use app_settings.minBillableHours (4 h)
alter table public.rate_cards
  add column min_billable_hours numeric check (min_billable_hours is null or min_billable_hours > 0);

-- RLS
alter table public.double_penalty_windows enable row level security;
create policy "Read active windows" on public.double_penalty_windows
  for select to anon, authenticated using (is_active);
create policy "Admins manage windows" on public.double_penalty_windows
  for all to authenticated using (is_active_admin(auth.uid())) with check (is_active_admin(auth.uid()));

alter table public.rate_items enable row level security;
create policy "Anon reads standard items" on public.rate_items
  for select to anon using (is_active and set_id = '00000000-0000-0000-0000-000000000001');
create policy "Staff read items" on public.rate_items
  for select to authenticated using (true);
create policy "Admins manage items" on public.rate_items
  for all to authenticated using (is_active_admin(auth.uid())) with check (is_active_admin(auth.uid()));

alter table public.pricing_test_cases enable row level security;
create policy "Staff read test cases" on public.pricing_test_cases
  for select to authenticated using (true);
create policy "Admins manage test cases" on public.pricing_test_cases
  for all to authenticated using (is_active_admin(auth.uid())) with check (is_active_admin(auth.uid()));
-- No anon policy on test cases: MOPT cases contain customer rates.
