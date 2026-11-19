-- ============================================================================
-- Zare Bench — seed
--
-- Exactly two archetypes. The demo candidates (step 13 of the build order)
-- land in a separate seed so this file stays safe to run against any
-- environment, including production.
-- ============================================================================

insert into public.archetypes
  (name, code, target_ready, freshness_days, coverage_ratio, color, communication_weight, technical_weight)
values
  ('Customer Service Representative', 'CSR', 20, 30, 4.0, '#10cfd1', 0.70, 0.30),
  ('Software Engineer',               'SWE', 12, 45, 5.0, '#7c8cf8', 0.40, 0.60)
on conflict (code) do nothing;
