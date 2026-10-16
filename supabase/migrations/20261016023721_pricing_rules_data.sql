-- Migration B — pricing rules data (BRIEF-estimator-pricing-rules-stage0 §9, Stage F).
--
-- Apply only after Stages C and D are live (they are: calc.ts prices the
-- windows and the per-role minimum; prebuild runs the shared cases). From
-- the moment this commits, every Vercel build runs these 22 cases.
--
-- One transaction: any failed statement or guard rolls back everything.
-- Re-running fails on the unique keys (rate_items, pricing_test_cases)
-- and the guard below, so it can't double up.

begin;

-- 1. D31 double-penalty windows and D25 rate items (§9, verbatim).
insert into double_penalty_windows (name, start_md, start_time, end_md, end_time, multiplier) values
  ('Christmas', '12-24', '20:00', '12-25', '12:00', 2),
  ('New Year',  '12-31', '20:00', '01-01', '12:00', 2);

insert into rate_items (set_id, code, name, kind, charge_ex_gst, unit_label, sort_order) values
  ('00000000-0000-0000-0000-000000000001', 'broadcast',    'Broadcast',     'per_person_per_event', 264.80, 'per person per event', 1),
  ('00000000-0000-0000-0000-000000000001', 'travel',       'Travel',        'travel_per_hour',       63.00, 'per hour',             2),
  ('00000000-0000-0000-0000-000000000001', 'harness_hire', 'Harness Hire',  'flat_item',             80.00, 'each',                 3),
  ('00000000-0000-0000-0000-000000000001', 'tolls',        'Tolls',         'flat_item',             null,  'at cost',              4),
  ((select id from rate_card_sets where code = 'mopt-ao'), 'ao_broadcast_allowance', 'Australian Open Broadcast Allowance',
                                                          'per_person_per_event', 257.75, 'per person per event', 1);

-- 2. S-3: the card's 30-minute Training minimum (§9, verbatim).
update rate_cards set min_billable_hours = 0.5
 where role_name in ('Online or Onsite Training', 'Australian Open Online or Onsite Training');

-- 3. S-2: retire the hourly Broadcast role. ⚠ Only after §6.2 (the picker) is live
-- update rate_cards set is_active = false
--  where role_name = 'Broadcast Rate' and set_id = '00000000-0000-0000-0000-000000000001';

-- 4. D33 shared test cases (§9.1), generated from
--    src/lib/estimator/pricingCases.fixture.json, which the unit tests pass.
--    Each case carries its own rates, so later rate changes never break one.
insert into pricing_test_cases (code, title, rule, scope, input, expected) values
  ('C01', 'Plain day', 'Plain day', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-10-14","startTime":"08:00","durationHours":4,"qty":1}}'::jsonb,
   '{"costExGst":252.0,"billableHours":4}'::jsonb),
  ('C02', 'Day to night at 20:00', 'Day → night at 20:00', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-10-14","startTime":"16:00","durationHours":6,"qty":1}}'::jsonb,
   '{"costExGst":411.8,"billableHours":6}'::jsonb),
  ('C03', 'OT8 at night rate, OT10 at Sun/PH', 'Overtime tiers', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-10-14","startTime":"08:00","durationHours":12,"qty":1}}'::jsonb,
   '{"costExGst":863.7,"billableHours":12}'::jsonb),
  ('C04', 'Saturday to Sunday at midnight', 'Midnight split', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-10-17","startTime":"20:00","durationHours":6,"qty":1}}'::jsonb,
   '{"costExGst":519.5,"billableHours":6}'::jsonb),
  ('C05', 'PH starts at 00:00', 'PH from midnight (D6)', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-11-02","startTime":"22:00","durationHours":4,"qty":1}}'::jsonb,
   '{"costExGst":359.7,"billableHours":4}'::jsonb),
  ('C06', '4 h minimum', 'Global minimum', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-10-14","startTime":"10:00","durationHours":2,"qty":1}}'::jsonb,
   '{"costExGst":252.0,"billableHours":4}'::jsonb),
  ('C07', 'Null over8 (M&OP)', 'No 8-hour tier', 'both',
   '{"rate":{"day":69.6,"night":69.6,"sunday":95.45,"publicHoliday":95.45,"over8":null,"over10":95.45},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-10-14","startTime":"08:00","durationHours":12,"qty":1}}'::jsonb,
   '{"costExGst":886.9,"billableHours":12}'::jsonb),
  ('C08', 'Show Crew Sunday 99.95', 'Sunday rate (D5)', 'both',
   '{"rate":{"day":84.5,"night":84.5,"sunday":99.95,"publicHoliday":99.95,"over8":84.5,"over10":84.5},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-10-18","startTime":"10:00","durationHours":4,"qty":1}}'::jsonb,
   '{"costExGst":399.8,"billableHours":4}'::jsonb),
  ('C09', 'Qty', 'Qty', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-10-14","startTime":"16:00","durationHours":6,"qty":3}}'::jsonb,
   '{"costExGst":1235.4,"billableHours":6}'::jsonb),
  ('C10', 'Weekday night', 'Weekday night', 'both',
   '{"rate":{"day":69.5,"night":89.6,"sunday":106.8,"publicHoliday":106.8,"over8":89.6,"over10":106.8},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-10-14","startTime":"22:00","durationHours":4,"qty":1}}'::jsonb,
   '{"costExGst":358.4,"billableHours":4}'::jsonb),
  ('X01', 'Window starts 20:00 on 24 Dec', 'D31 window', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-12-24","startTime":"18:00","durationHours":8,"qty":1}}'::jsonb,
   '{"costExGst":1325.4,"billableHours":8,"segments":[{"tier":"base","period":"day","dateISO":"2026-12-24","hours":2,"rate":63.0,"costExGst":126.0,"doublePenalty":false},{"tier":"base","period":"night","dateISO":"2026-12-24","hours":4,"rate":199.9,"costExGst":799.6,"doublePenalty":true},{"tier":"base","period":"night","dateISO":"2026-12-25","hours":2,"rate":199.9,"costExGst":399.8,"doublePenalty":true}]}'::jsonb),
  ('X02', 'Window ends 12:00 on 25 Dec; then ordinary PH', 'D31 window', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-12-25","startTime":"10:00","durationHours":4,"qty":1}}'::jsonb,
   '{"costExGst":599.7,"billableHours":4}'::jsonb),
  ('X03', 'NYE window', 'D31 window', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-12-31","startTime":"22:00","durationHours":4,"qty":1}}'::jsonb,
   '{"costExGst":799.6,"billableHours":4}'::jsonb),
  ('X04', 'Substitute holiday is not doubled', 'D31 window', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-12-28","startTime":"10:00","durationHours":4,"qty":1}}'::jsonb,
   '{"costExGst":399.8,"billableHours":4}'::jsonb),
  ('X05', 'Boxing Day is ordinary PH', 'D31 window', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-12-26","startTime":"10:00","durationHours":4,"qty":1}}'::jsonb,
   '{"costExGst":399.8,"billableHours":4}'::jsonb),
  ('X06', 'Window beats overtime', 'D31 window', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-12-24","startTime":"12:00","durationHours":12,"qty":1}}'::jsonb,
   '{"costExGst":1303.6,"billableHours":12}'::jsonb),
  ('X07', 'NYE window ends 12:00 on 1 Jan (crosses the year)', 'D31 window', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2027-01-01","startTime":"10:00","durationHours":4,"qty":1}}'::jsonb,
   '{"costExGst":599.7,"billableHours":4}'::jsonb),
  ('X08', 'Window uses the role''s own PH rate', 'D31 window', 'both',
   '{"rate":{"day":84.5,"night":84.5,"sunday":99.95,"publicHoliday":99.95,"over8":84.5,"over10":84.5},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-12-24","startTime":"20:00","durationHours":4,"qty":1}}'::jsonb,
   '{"costExGst":799.6,"billableHours":4}'::jsonb),
  ('X09', '24 Dec before 20:00 is an ordinary day', 'D31 window', 'both',
   '{"rate":{"day":63.0,"night":79.9,"sunday":99.95,"publicHoliday":99.95,"over8":79.9,"over10":99.95},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-12-24","startTime":"14:00","durationHours":4,"qty":1}}'::jsonb,
   '{"costExGst":252.0,"billableHours":4}'::jsonb),
  ('C11', 'Per-role minimum: 1 h of Training bills 1 h, not 4', 'Per-role minimum (S-3)', 'both',
   '{"rate":{"day":69.6,"night":69.6,"sunday":95.45,"publicHoliday":95.45,"over8":null,"over10":95.45,"minBillableHours":0.5},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-10-14","startTime":"10:00","durationHours":1,"qty":1}}'::jsonb,
   '{"costExGst":69.6,"billableHours":1}'::jsonb),
  ('C12', 'Per-role minimum applies below it', 'Per-role minimum (S-3)', 'both',
   '{"rate":{"day":69.6,"night":69.6,"sunday":95.45,"publicHoliday":95.45,"over8":null,"over10":95.45,"minBillableHours":0.5},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-10-14","startTime":"10:00","durationHours":0.25,"qty":1}}'::jsonb,
   '{"costExGst":34.8,"billableHours":0.5}'::jsonb),
  ('C13', 'No per-role minimum: the global 4 h still applies', 'Per-role minimum (S-3)', 'both',
   '{"rate":{"day":69.6,"night":69.6,"sunday":95.45,"publicHoliday":95.45,"over8":null,"over10":95.45},"settings":{"dayStart":"08:00","nightStart":"20:00","minBillableHours":4},"publicHolidays":["2026-11-03","2026-12-25","2026-12-26","2026-12-28","2027-01-01"],"doublePenaltyWindows":[{"name":"Christmas","startMd":"12-24","startTime":"20:00","endMd":"12-25","endTime":"12:00","multiplier":2},{"name":"New Year","startMd":"12-31","startTime":"20:00","endMd":"01-01","endTime":"12:00","multiplier":2}],"line":{"shiftDate":"2026-10-14","startTime":"10:00","durationHours":1,"qty":1}}'::jsonb,
   '{"costExGst":278.4,"billableHours":4}'::jsonb);

-- Guards: abort the whole transaction if anything landed differently.
do $$
begin
  if (select count(*) from double_penalty_windows where is_active) <> 2 then
    raise exception 'expected 2 active double_penalty_windows';
  end if;
  if (select count(*) from rate_items where is_active) <> 5 then
    raise exception 'expected 5 active rate_items';
  end if;
  if (select count(distinct role_name) from rate_cards
       where min_billable_hours = 0.5
         and role_name in ('Online or Onsite Training', 'Australian Open Online or Onsite Training')) <> 2 then
    raise exception 'expected both Training roles to have min_billable_hours = 0.5';
  end if;
  if (select count(*) from rate_cards
       where min_billable_hours is not null
         and role_name not in ('Online or Onsite Training', 'Australian Open Online or Onsite Training')) <> 0 then
    raise exception 'only the Training roles may have a per-role minimum';
  end if;
  if (select count(*) from pricing_test_cases where is_active and scope = 'both') <> 22 then
    raise exception 'expected 22 active scope-both pricing_test_cases';
  end if;
end $$;

commit;
