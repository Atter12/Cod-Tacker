-- Store contact email OTP verification (Entregable 1 — Fases 1+2)
-- Tokens stored as hash only; server actions use service role.

create table if not exists public.store_contact_email_otps (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint store_contact_email_otps_email_normalized check (email = lower(trim(email)))
);

create index if not exists store_contact_email_otps_store_id_idx
  on public.store_contact_email_otps (store_id);

create index if not exists store_contact_email_otps_active_idx
  on public.store_contact_email_otps (store_id, email)
  where consumed_at is null;

comment on table public.store_contact_email_otps is
  'Pending OTP challenges for store contact email verification. Hash-only; service-role access.';

alter table public.store_contact_email_otps enable row level security;
