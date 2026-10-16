-- Retire the hourly "Broadcast Rate" role (BRIEF-estimator-pricing-rules-stage0 §6.3, S-2).
--
-- FOR THE RECORD ONLY. Already applied to production on 16 Oct 2026 as
-- version 20261016031018, after Migration B (pricing_rules_data) and once
-- the §6.2 picker was live. This file's name matches that version, so
-- `supabase db push` treats it as applied. Do not run it again.
--
-- This is the line Migration B left commented out. Broadcast is now quoted
-- as the `broadcast` rate item, qty = people.

update rate_cards set is_active = false
 where role_name = 'Broadcast Rate' and set_id = '00000000-0000-0000-0000-000000000001';
