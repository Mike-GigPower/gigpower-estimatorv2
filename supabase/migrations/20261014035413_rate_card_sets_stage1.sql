-- Rate card sets, stage 1 (P1).
--
-- FOR THE RECORD ONLY. Already applied to production on 14 Oct 2026 as
-- version 20261014035413; this file's name matches that version, so
-- `supabase db push` treats it as applied. Do not run it again.
--
-- SQL copied verbatim from supabase_migrations.schema_migrations.
-- This creates rate_card_sets before its updated_at trigger existed;
-- set_rate_card_sets_updated_at came in 20261015234756.

-- 1. Card sets
create table public.rate_card_sets (
  id                       uuid primary key default gen_random_uuid(),
  code                     text unique not null,
  name                     text not null,
  kind                     text not null check (kind in ('standard','customer')),
  smartstaff_customer_ids  int[] not null default '{}',
  source_doc               text,
  is_active                boolean not null default true,
  sort_order               int not null default 0,
  updated_at               timestamptz not null default now()
);

insert into public.rate_card_sets (id, code, name, kind, sort_order)
values ('00000000-0000-0000-0000-000000000001', 'standard', 'Standard', 'standard', 0);

-- 2. Rates belong to a set; existing rows become Standard
alter table public.rate_cards
  add column set_id uuid not null
    default '00000000-0000-0000-0000-000000000001'
    references public.rate_card_sets(id),
  add column call_names text[] not null default '{}';

create index idx_rate_cards_set on public.rate_cards (set_id);
create unique index rate_cards_set_role_effective_from_unique
  on public.rate_cards (set_id, role_name, effective_from);

-- 3. RLS: anon sees the Standard card only (C1)
drop policy "Allow public read active rate cards" on public.rate_cards;
create policy "Allow public read active standard rate cards"
  on public.rate_cards for select to anon
  using (is_active and set_id = '00000000-0000-0000-0000-000000000001');

alter table public.rate_card_sets enable row level security;
create policy "Authenticated read rate card sets"
  on public.rate_card_sets for select to authenticated using (true);
create policy "Admins manage rate card sets"
  on public.rate_card_sets for all to authenticated
  using (is_active_admin(auth.uid())) with check (is_active_admin(auth.uid()));
