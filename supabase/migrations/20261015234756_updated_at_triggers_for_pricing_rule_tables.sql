-- updated_at triggers for the pricing rule tables.
--
-- FOR THE RECORD ONLY. Already applied to production on 16 Oct 2026 as
-- version 20261015234756; this file's name matches that version, so
-- `supabase db push` treats it as applied. Do not run it again.
--
-- Keeps updated_at honest on every table the rate-cards edge function
-- serves, so THE GOAT can tell when a rule last changed.

begin;

-- Pin the trigger function's search_path.
alter function public.handle_updated_at() set search_path = '';

create trigger set_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.handle_updated_at();

create trigger set_rate_card_sets_updated_at
  before update on public.rate_card_sets
  for each row execute function public.handle_updated_at();

create trigger set_double_penalty_windows_updated_at
  before update on public.double_penalty_windows
  for each row execute function public.handle_updated_at();

create trigger set_rate_items_updated_at
  before update on public.rate_items
  for each row execute function public.handle_updated_at();

create trigger set_pricing_test_cases_updated_at
  before update on public.pricing_test_cases
  for each row execute function public.handle_updated_at();

commit;
