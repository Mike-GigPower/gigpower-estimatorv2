-- Rate card sets: MOPT seed (P1).
--
-- FOR THE RECORD ONLY. Already applied to production on 14 Oct 2026 as
-- version 20261014054429; this file's name matches that version, so
-- `supabase db push` treats it as applied. Do not run it again.
--
-- SQL copied verbatim from supabase_migrations.schema_migrations.

insert into public.rate_card_sets (code, name, kind, source_doc, sort_order) values
  ('mopt',    'MOPT — Year Round',      'customer', 'Gig Power Pricing Template v2.429', 10),
  ('mopt-ao', 'MOPT — Australian Open', 'customer', 'Gig Power Pricing Template v2.429', 20);

insert into public.rate_cards
  (set_id, role_name, category, day_rate, night_rate, sunday_rate, public_holiday_rate,
   ot_8_day_rate, ot_8_night_rate, ot_10_day_rate, ot_10_night_rate,
   effective_from, sort_order, is_active, call_names)
select s.id, v.role, 'standard', v.d, v.d, v.s, v.s, null, null, v.s, v.s,
       '2026-07-01', v.sort, true, array[v.role]
from public.rate_card_sets s
join (values
  ('mopt',    'Event Operations',                          69.60,  95.45, 10),
  ('mopt',    'Forklift Driver',                           77.43, 103.87, 20),
  ('mopt',    'Online or Onsite Training',                 69.60,  95.45, 30),
  ('mopt-ao', 'Australian Open Event Operations',          72.14,  98.10, 10),
  ('mopt-ao', 'Australian Open Forklift Driver',           80.07, 106.51, 20),
  ('mopt-ao', 'Australian Open Online or Onsite Training', 72.14,  98.10, 30),
  ('mopt-ao', 'Field of Play Operations',                  87.90,  98.10, 40)
) as v(code, role, d, s, sort) on v.code = s.code;
