-- Align column defaults with application defaults (Peru-first product).
-- Does not rewrite existing rows; only changes defaults for new inserts.

alter table public.agencies
  alter column currency_code set default 'PEN'::bpchar;

alter table public.stores
  alter column currency_code set default 'PEN'::bpchar;

-- New automation rules should start inactive unless the app sets is_active explicitly.
alter table public.automation_rules
  alter column is_active set default false;

comment on column public.agencies.currency_code is
  'Default PEN to match onboarding/createStore app defaults.';
comment on column public.stores.currency_code is
  'Default PEN to match onboarding/createStore app defaults.';
comment on column public.automation_rules.is_active is
  'Default false; rules activate only when explicitly enabled.';
