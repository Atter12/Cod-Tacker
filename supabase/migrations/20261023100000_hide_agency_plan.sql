-- Agency ($399) is no longer offered publicly: Facturación shows Starter, Growth,
-- Scale and Enterprise only. Agencies already on Agency keep their plan and limits
-- (the row stays active); it just stops appearing in the plan comparison.

update public.plans
set
  is_public = false,
  updated_at = now()
where code = 'agency';
