-- Lock down quotes RLS (BRIEF-estimator-pricing-rules-stage0, "Before this brief: a security finding").
--
-- FOR THE RECORD ONLY. Already applied to production on 15 Oct 2026 as
-- version 20261015040050; this file's name matches that version, so
-- `supabase db push` treats it as applied. Do not run it again.
--
-- The publishable key ships in the public estimate form, so with RLS off
-- anyone holding it could read or change every quote version.

begin;

-- 1. Quote numbers: callable by signed-in staff only. SECURITY DEFINER so it
--    can bump quote_counter, which has RLS on and no policies.
alter function public.next_quote_number() security definer;
alter function public.next_quote_number() set search_path = public;
revoke execute on function public.next_quote_number() from public, anon;
grant execute on function public.next_quote_number() to authenticated;

-- 2. quote_counter: RLS on, no policies. Only next_quote_number() touches it.
alter table public.quote_counter enable row level security;

-- 3. quote_versions: staff read and add. No update or delete.
alter table public.quote_versions enable row level security;
create policy "Staff read quote versions" on public.quote_versions
  for select to authenticated using (true);
create policy "Staff add quote versions" on public.quote_versions
  for insert to authenticated with check (true);

-- 4. quotes: drop the four policies open to public.
drop policy "Allow read access" on public.quotes;
drop policy "Allow Insert" on public.quotes;
drop policy "Allow update" on public.quotes;
drop policy "Allow delete" on public.quotes;

commit;
